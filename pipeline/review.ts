/**
 * カードレビュー CLI(Phase 0 の簡易レビューツール)。
 *
 *   pnpm content:review <subject_id> [--reviewer <名前>] [--status draft]
 *   pnpm content:review <subject_id> --publish        # reviewed → published にして manifest を更新
 *
 * 1 枚ずつ表示し、a=承認 / e=修正($EDITOR で JSON を編集) / r=却下 / s=スキップ / q=終了。
 * 決定のたびに cards.jsonl を書き戻し、終了時に manifest.json を再生成する。
 */
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import {
  readPackage,
  serializeCards,
  writeManifest,
} from "../src/shared/content/package";
import { cardStatusSchema, type Card } from "../src/shared/content/schema";
import { parseArgs } from "./lib/args";
import {
  applyDecision,
  publishReviewed,
  renderCard,
  summarize,
} from "./lib/review-ops";

async function editInEditor(card: Card): Promise<unknown | null> {
  const editor = process.env.EDITOR ?? process.env.VISUAL ?? "vi";
  const dir = await mkdtemp(path.join(tmpdir(), "lexigrep-review-"));
  const file = path.join(dir, `${card.id}.json`);
  await writeFile(file, JSON.stringify(card, null, 2) + "\n", "utf8");
  const result = spawnSync(editor, [file], { stdio: "inherit" });
  if (result.status !== 0) return null;
  return JSON.parse(await readFile(file, "utf8"));
}

async function main(): Promise<number> {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const subjectId = positional[0];
  if (!subjectId) {
    console.error(
      "使い方: pnpm content:review <subject_id> [--reviewer <名前>] [--status draft] [--publish]",
    );
    return 1;
  }
  const dir = path.resolve(process.cwd(), "content", subjectId);
  const reviewer = String(
    flags.get("reviewer") ?? process.env.LEXIGREP_REVIEWER ?? "owner",
  );
  const pkg = await readPackage(dir);
  const cards = [...pkg.cards];
  const save = async () => {
    await writeFile(
      path.join(dir, "cards.jsonl"),
      serializeCards(cards),
      "utf8",
    );
  };

  if (flags.get("publish")) {
    const r = publishReviewed(cards, new Date());
    cards.splice(0, cards.length, ...r.cards);
    await save();
    await writeManifest(dir, `review@${reviewer}`, new Date());
    console.log(
      `published: ${r.count} 枚 / 内訳: ${JSON.stringify(summarize(cards))}`,
    );
    return 0;
  }

  const targetStatus = cardStatusSchema.parse(flags.get("status") ?? "draft");
  const targets = cards
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.status === targetStatus);
  console.log(
    `${subjectId}: ${targets.length} 枚が ${targetStatus}(全 ${cards.length} 枚)。reviewer=${reviewer}`,
  );
  if (targets.length === 0) return 0;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (let n = 0; n < targets.length; n++) {
      const { c, i } = targets[n]!;
      console.log("\n" + renderCard(c, n, targets.length));
      const ans = (
        await rl.question("[a]承認 [e]修正 [r]却下 [s]スキップ [q]終了 > ")
      )
        .trim()
        .toLowerCase();
      if (ans === "q") break;
      if (ans === "s" || ans === "") continue;
      try {
        if (ans === "a")
          cards[i] = applyDecision(c, "approve", reviewer, new Date());
        else if (ans === "r")
          cards[i] = applyDecision(c, "reject", reviewer, new Date());
        else if (ans === "e") {
          const edited = await editInEditor(c);
          if (edited === null) {
            console.log("  編集を取り消しました");
            continue;
          }
          cards[i] = applyDecision(c, "edit", reviewer, new Date(), edited);
        } else {
          console.log("  不明な入力です");
          n--;
          continue;
        }
        await save();
        console.log(`  → ${cards[i]!.status}`);
      } catch (err) {
        console.error(`  保存できません: ${(err as Error).message}`);
        n--;
      }
    }
  } finally {
    rl.close();
  }
  await writeManifest(dir, `review@${reviewer}`, new Date());
  console.log(`内訳: ${JSON.stringify(summarize(cards))}`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
