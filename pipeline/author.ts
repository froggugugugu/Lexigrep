/**
 * 執筆スペック(語句・意味・選択肢)からカードを起こす。実文と出典はクロール済みコーパスから選ぶ。
 *
 *   pnpm pipeline:author --subject typescript --spec pipeline/specs/typescript.json [--out content/typescript/cards.jsonl]
 *
 * 入力: pipeline/work/<subject>/pages.json(pipeline:crawl の出力)と spec ファイル
 * 出力: cards.jsonl(status=draft)。既存ファイルがあれば同じ層・語句・実文は追加しない
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  parseCardsJsonl,
  serializeCards,
  writeManifest,
} from "../src/shared/content/package";
import { flagString, parseArgs } from "./lib/args";
import { authorCard, authorFileSchema, linkRelated } from "./lib/author-core";
import { mergeCards } from "./lib/generate-core";
import { readPages } from "./lib/work";

async function main(): Promise<number> {
  const { flags } = parseArgs(process.argv.slice(2));
  const subjectId = flagString(flags, "subject", "");
  const specFile = flagString(flags, "spec", "");
  if (!subjectId || !specFile) {
    console.error(
      "使い方: pnpm pipeline:author --subject <id> --spec <file.json> [--out <cards.jsonl>]",
    );
    return 1;
  }
  const out = flagString(
    flags,
    "out",
    path.join("content", subjectId, "cards.jsonl"),
  );
  const spec = authorFileSchema.parse(
    JSON.parse(await readFile(specFile, "utf8")),
  );
  if (spec.subject_id !== subjectId) {
    console.error(
      `spec の subject_id(${spec.subject_id})が --subject(${subjectId})と一致しません`,
    );
    return 1;
  }
  const pages = await readPages(subjectId);
  const now = new Date();
  const results = spec.specs.map((s) =>
    authorCard(s, subjectId, spec.generated_by, pages.pages, now),
  );
  const authored = linkRelated(
    results.flatMap((r) => (r.ok ? [r.card] : [])),
    spec.specs,
  );
  const failed = results.flatMap((r) => (r.ok ? [] : [r]));

  let existing = [] as ReturnType<typeof parseCardsJsonl>["cards"];
  try {
    const parsed = parseCardsJsonl(await readFile(out, "utf8"));
    existing = parsed.cards;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  const merged = mergeCards(existing, authored);
  const dir = path.dirname(out);
  await mkdir(dir, { recursive: true });
  await writeFile(out, serializeCards(merged.cards), "utf8");
  try {
    await writeManifest(dir, `pipeline:author@${spec.generated_by}`, now);
  } catch {
    // subject.json が無いディレクトリ(作業用)では manifest を作らない
  }
  console.log(
    `${subjectId}: spec ${spec.specs.length} 件 → 作成 ${authored.length} / 追加 ${merged.added} / 重複 ${merged.skipped} / 失敗 ${failed.length}`,
  );
  for (const f of failed) console.log(`  ✘ ${f.target}: ${f.reason}`);
  return failed.length === 0 ? 0 : 2;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
