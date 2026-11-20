/**
 * 頻度上位の語句から Claude でカード候補(status=draft)を生成し、content/<subject>/cards.jsonl に追記する。
 *
 *   pnpm pipeline:generate --subject typescript [--limit 40] [--batch 10] [--model claude-sonnet-5-5] [--dry-run]
 *
 * 必要な環境変数: ANTHROPIC_API_KEY(--dry-run ではプロンプトを表示するだけで呼び出さない)
 * 生成結果はクロール済みコーパスと照合し、実文はコーパス側の原文を採用する(実文に紐づく学習の原則)。
 * 順位(frequency_rank)は頻度表の位置からコードで決める。各バッチの結果は直後に書き込む。
 * LLM はこのバッチでのみ呼ぶ(ユーザー操作ごとには呼ばない)。
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import {
  readPackage,
  serializeCards,
  writeManifest,
} from "../src/shared/content/package";
import { flagNumber, flagString, parseArgs } from "./lib/args";
import {
  CARD_TOOL,
  assembleCard,
  buildSystemPrompt,
  buildUserPrompt,
  generatedBatchSchema,
  mergeCards,
  rankForGenerated,
  selectTargets,
  verifyGenerated,
} from "./lib/generate-core";
import { readFrequency, readPages } from "./lib/work";

const DEFAULT_MODEL = "claude-sonnet-5-5";

async function callClaude(
  client: Anthropic,
  model: string,
  system: string,
  user: string,
): Promise<unknown> {
  const response = await client.messages.create({
    model,
    max_tokens: 8192,
    system,
    messages: [{ role: "user", content: user }],
    tools: [CARD_TOOL],
    tool_choice: { type: "tool", name: CARD_TOOL.name },
  });
  const block = response.content.find((c) => c.type === "tool_use");
  if (!block || block.type !== "tool_use")
    throw new Error("ツール応答がありません");
  return block.input;
}

async function main(): Promise<number> {
  const { flags } = parseArgs(process.argv.slice(2));
  const subjectId = flagString(flags, "subject", "");
  if (!subjectId) {
    console.error(
      "使い方: pnpm pipeline:generate --subject <id> [--limit 40] [--batch 10] [--model ...] [--dry-run]",
    );
    return 1;
  }
  const limit = flagNumber(flags, "limit", 40);
  const batchSize = flagNumber(flags, "batch", 10);
  const model = flagString(flags, "model", DEFAULT_MODEL);
  const dryRun = flags.get("dry-run") === true;

  const dir = path.join(process.cwd(), "content", subjectId);
  const pkg = await readPackage(dir);
  const freq = await readFrequency(subjectId);
  const pages = await readPages(subjectId);
  const targets = selectTargets(freq.terms, pkg.cards, limit);
  console.log(
    `${subjectId}: 既存 ${pkg.cards.length} 枚 / 生成対象 ${targets.length} 語句 / model=${model}`,
  );
  if (targets.length === 0) return 0;

  const system = buildSystemPrompt(pkg.subject);
  if (dryRun) {
    console.log("--dry-run: 最初のバッチのプロンプトを表示します\n");
    console.log(
      system + "\n\n" + buildUserPrompt(targets.slice(0, batchSize), 0),
    );
    return 0;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "ANTHROPIC_API_KEY が未設定です(--dry-run で確認だけできます)",
    );
    return 1;
  }

  const client = new Anthropic();
  const generator = `claude:${model}`;
  let cards = pkg.cards;
  let added = 0;
  let skipped = 0;
  const rejected: { target: string; reason: string }[] = [];

  for (let i = 0; i < targets.length; i += batchSize) {
    const batch = targets.slice(i, i + batchSize);
    const rankOffset = pkg.cards.length + i;
    console.log(
      `バッチ ${i / batchSize + 1}: ${batch.map((t) => t.term).join(", ")}`,
    );
    let raw: unknown;
    try {
      raw = await callClaude(
        client,
        model,
        system,
        buildUserPrompt(batch, rankOffset),
      );
    } catch (err) {
      // 1 バッチの失敗で、それまでの結果を失わない(各バッチの結果は直後に書き込む)
      console.error(`  API 呼び出しに失敗: ${(err as Error).message}`);
      continue;
    }
    const parsed = generatedBatchSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(
        `  応答がスキーマに合いません: ${parsed.error.issues.map((e) => e.message).join("; ")}`,
      );
      continue;
    }
    const accepted = [];
    for (const g of parsed.data.cards) {
      const v = verifyGenerated(g, pages.pages);
      if (!v.ok) {
        rejected.push({ target: g.target, reason: v.reason });
        continue;
      }
      const rank = rankForGenerated(g, batch, rankOffset);
      if (rank === null) {
        rejected.push({ target: g.target, reason: "指示した語句に対応しない" });
        continue;
      }
      accepted.push(assembleCard(g, subjectId, v, generator, new Date(), rank));
    }
    const merged = mergeCards(cards, accepted);
    cards = merged.cards;
    added += merged.added;
    skipped += merged.skipped;
    await writeFile(
      path.join(dir, "cards.jsonl"),
      serializeCards(cards),
      "utf8",
    );
  }

  await writeManifest(dir, `pipeline:generate@${model}`, new Date());
  console.log(
    `追加 ${added} 枚 / 重複スキップ ${skipped} 枚 / 照合で却下 ${rejected.length} 枚`,
  );
  for (const r of rejected) console.log(`  ✘ ${r.target}: ${r.reason}`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
