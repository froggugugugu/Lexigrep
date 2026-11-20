"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { CardResult, Layer } from "@/shared/content/schema";
import { Button, LinkButton } from "@/shared/ui/Button";
import { Badge } from "@/shared/ui/Badge";
import { HighlightedSentence } from "@/shared/ui/HighlightedSentence";
import { ProgressBar } from "@/shared/ui/ProgressBar";
import { LAYER_LABELS, QUESTION_PROMPTS } from "@/shared/ui/labels";
import { answerCardAction, completeSessionAction } from "./actions";
import type { SessionCard } from "./types";

type Phase = "question" | "feedback" | "done";

type QueueItem = { index: number; retry: boolean };

type Props = {
  cards: SessionCard[];
  startedAt: string;
  filter: { subjectId: string | null; layer: Layer | null };
};

/**
 * 1 カード = 1 画面。実文 → 設問 → 即時フィードバック → 解説 → 次へ。
 * 間違えたカードはセッション末尾で 1 回だけ再出題する(結果の記録は最初の回答のみ)。
 */
export function SessionRunner(props: Props) {
  // 再描画(revalidate / router.refresh)で新しい出題が届いても、進行中のセッションは開始時の内容で続ける
  const [{ cards, startedAt, filter }] = useState(props);
  const [queue, setQueue] = useState<QueueItem[]>(() =>
    cards.map((_, index) => ({ index, retry: false })),
  );
  const [position, setPosition] = useState(0);
  const [phase, setPhase] = useState<Phase>(
    cards.length === 0 ? "done" : "question",
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [results, setResults] = useState<CardResult[]>([]);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [logId, setLogId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const shownAtRef = useRef<number>(0);
  const completedRef = useRef(false);

  const current = queue[position];
  const item = current ? cards[current.index] : undefined;
  const totalPlanned = queue.length;
  const remaining = Math.max(0, totalPlanned - position);

  useEffect(() => {
    shownAtRef.current = performance.now();
  }, [position]);

  const isCorrect =
    item !== undefined &&
    selected !== null &&
    selected === item.card.choices.answer;

  const answer = useCallback(
    (optionIndex: number) => {
      if (!item || !current || phase !== "question") return;
      const correct = optionIndex === item.card.choices.answer;
      const elapsedMs = Math.max(
        0,
        Math.round(performance.now() - shownAtRef.current),
      );
      setSelected(optionIndex);
      setPhase("feedback");

      if (!current.retry) {
        setResults((r) => [
          ...r,
          { card_id: item.card.id, correct, elapsed_ms: elapsedMs },
        ]);
        if (!correct) {
          setQueue((q) => [...q, { index: current.index, retry: true }]);
        }
      }

      startTransition(async () => {
        try {
          const res = await answerCardAction({
            cardId: item.card.id,
            answer: correct ? "correct" : "incorrect",
          });
          setAnswerError(res.ok ? null : res.message);
        } catch {
          // 通信断など。学習は続行できる(次の回答で再び保存を試みる)
          setAnswerError(
            "回答の保存に失敗しました(通信状態を確認してください)",
          );
        }
      });
    },
    [current, item, phase],
  );

  const finish = useCallback(
    (finalResults: CardResult[]) => {
      if (completedRef.current) return;
      completedRef.current = true;
      setPhase("done");
      setCompleteError(null);
      startTransition(async () => {
        try {
          const res = await completeSessionAction({
            startedAt,
            subjectId: filter.subjectId,
            layer: filter.layer,
            results: finalResults,
          });
          if (res.ok) {
            setLogId(res.logId);
          } else {
            completedRef.current = false; // 再試行できるようにする
            setCompleteError(res.message);
          }
        } catch {
          completedRef.current = false;
          setCompleteError("通信に失敗しました");
        }
      });
    },
    [filter.layer, filter.subjectId, startedAt],
  );

  const next = useCallback(() => {
    if (position + 1 >= queue.length) {
      finish(results);
      return;
    }
    setSelected(null);
    setPhase("question");
    setPosition((p) => p + 1);
  }, [finish, position, queue.length, results]);

  const orderedOptions = useMemo(() => {
    if (!item) return [];
    return item.optionOrder.map((optionIndex) => ({
      optionIndex,
      label: item.card.choices.options[optionIndex] ?? "",
    }));
  }, [item]);

  if (phase === "done" || !item || !current) {
    const correctCount = results.filter((r) => r.correct).length;
    return (
      <section
        className="flex flex-1 flex-col justify-between"
        data-testid="session-complete"
      >
        <div className="space-y-4">
          <h1 className="text-xl font-semibold">セッション完了</h1>
          {cards.length === 0 ? (
            <p className="text-muted">
              今日出題できるカードがありません。別の題材や層を選ぶか、明日また開いてください。
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-3">
              <Stat
                label="正解"
                value={`${correctCount} / ${results.length}`}
              />
              <Stat
                label="正答率"
                value={
                  results.length === 0
                    ? "—"
                    : `${Math.round((correctCount / results.length) * 100)}%`
                }
              />
            </dl>
          )}
          {completeError ? (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-danger">
                セッションの記録に失敗しました: {completeError}
              </p>
              <Button
                variant="secondary"
                onClick={() => finish(results)}
                data-testid="retry-complete"
              >
                再試行
              </Button>
            </div>
          ) : logId ? (
            <p className="text-sm text-success" data-testid="session-saved">
              進捗を保存しました
            </p>
          ) : cards.length > 0 ? (
            <p className="text-sm text-muted">保存中…</p>
          ) : null}
          {answerError ? (
            <p role="alert" className="text-sm text-warning">
              一部の回答が保存できませんでした: {answerError}
            </p>
          ) : null}
        </div>
        <div className="space-y-3 pb-island">
          <LinkButton href="/dashboard" size="lg" full>
            ダッシュボードを見る
          </LinkButton>
          <LinkButton href="/" variant="secondary" size="lg" full>
            ホームへ戻る
          </LinkButton>
        </div>
      </section>
    );
  }

  const { card } = item;
  const prompt = card.prompt_ja ?? QUESTION_PROMPTS[card.question_type];
  const source = card.sources[0];

  return (
    <section
      className="flex flex-1 flex-col"
      data-testid="session-runner"
      data-phase={phase}
    >
      {/* 上半分: 進捗・実文・設問 */}
      <div className="flex-1">
        <div className="mb-3 flex items-center justify-between text-xs text-muted">
          <span className="tabular-nums" data-testid="remaining">
            残り {remaining} 枚{current.retry ? "(再出題)" : ""}
          </span>
          <span className="flex items-center gap-1">
            <Badge>{card.subject_id}</Badge>
            <Badge tone="accent">{LAYER_LABELS[card.layer]}</Badge>
          </span>
        </div>
        <ProgressBar
          value={position / Math.max(1, totalPlanned)}
          label="セッションの進捗"
          className="mb-4"
        />

        <HighlightedSentence
          sentence={card.sentence}
          highlight={card.highlight}
          blank={card.question_type === "fill_blank" && phase === "question"}
        />
        <p className="mt-4 text-base font-medium" data-testid="prompt">
          {prompt}
        </p>
        {answerError ? (
          <p role="alert" className="mt-2 text-xs text-warning">
            {answerError}
          </p>
        ) : null}

        {phase === "feedback" ? (
          <div
            className={`lg-feedback-enter mt-4 space-y-2 rounded-lg border p-3 ${isCorrect ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"}`}
            data-testid="feedback"
            data-correct={isCorrect}
          >
            <p
              className={`font-semibold ${isCorrect ? "text-success" : "text-danger"}`}
            >
              {isCorrect ? "正解" : "不正解"}
            </p>
            <p>
              <span className="text-accent">{card.target}</span> —{" "}
              {card.meaning_ja}
            </p>
            {card.note_ja ? (
              <p className="text-sm text-muted">{card.note_ja}</p>
            ) : null}
            {source ? (
              <p className="text-xs text-muted">
                出典:{" "}
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-dotted underline-offset-2"
                >
                  {source.title}
                </a>
              </p>
            ) : null}
            <Link
              href={`/cards/${card.id}`}
              className="text-xs text-accent underline-offset-2 hover:underline"
            >
              カードの詳細・間違い報告
            </Link>
          </div>
        ) : null}
      </div>

      {/* 下半分: 回答操作(親指だけで完結) */}
      <div className="sticky bottom-0 -mx-4 border-t border-border bg-background/95 px-4 pt-3 pb-island backdrop-blur">
        {phase === "question" ? (
          <ol className="space-y-2" aria-label="選択肢">
            {orderedOptions.map(({ optionIndex, label }, i) => (
              <li key={optionIndex}>
                <Button
                  variant="secondary"
                  size="lg"
                  full
                  className="justify-start text-left leading-snug whitespace-normal"
                  onClick={() => answer(optionIndex)}
                  data-testid="option"
                  data-option-index={optionIndex}
                >
                  <span className="mr-2 text-xs text-muted tabular-nums">
                    {i + 1}
                  </span>
                  <span
                    lang={
                      card.question_type === "fill_blank" ||
                      card.question_type === "recognize_pattern"
                        ? "en"
                        : "ja"
                    }
                  >
                    {label}
                  </span>
                </Button>
              </li>
            ))}
          </ol>
        ) : (
          <div className="space-y-2">
            {selected !== null && !isCorrect ? (
              <p className="text-sm text-muted">
                正解:{" "}
                <span className="font-medium text-foreground">
                  {card.choices.options[card.choices.answer]}
                </span>
              </p>
            ) : null}
            <Button size="lg" full onClick={next} data-testid="next" autoFocus>
              {position + 1 >= queue.length ? "完了" : "次へ"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
