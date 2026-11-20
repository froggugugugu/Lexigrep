/**
 * クロール結果から語・2〜4gram の出現頻度を集計する。
 *
 *   pnpm pipeline:frequency --subject typescript [--top 300] [--max-n 4] [--min-count 2] [--exclude "typescript,javascript"]
 *
 * 入力: pipeline/work/<subject>/pages.json
 * 出力: pipeline/work/<subject>/frequency.json(上位リスト + 例文と URL)
 */
import path from "node:path";
import { flagNumber, flagString, parseArgs } from "./lib/args";
import { countNgrams, dropBoilerplate } from "./lib/text";
import { readPages, workDir, writeJson, type FrequencyFile } from "./lib/work";

async function main(): Promise<number> {
  const { flags } = parseArgs(process.argv.slice(2));
  const subjectId = flagString(flags, "subject", "");
  if (!subjectId) {
    console.error(
      "使い方: pnpm pipeline:frequency --subject <id> [--top 300] [--max-n 4] [--min-count 2]",
    );
    return 1;
  }
  const pages = await readPages(subjectId);
  const urlOf = new Map<string, string>();
  const sentences: string[] = [];
  const cleaned = dropBoilerplate(pages.pages.map((p) => p.sentences));
  pages.pages.forEach((p, i) => {
    for (const s of cleaned[i] ?? []) {
      if (!urlOf.has(s)) urlOf.set(s, p.url);
      sentences.push(s);
    }
  });
  const excludeFlag = flagString(
    flags,
    "exclude",
    subjectId.replace(/-/g, " "),
  );
  const exclude = new Set(
    excludeFlag
      .split(/[,\s]+/)
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean),
  );
  const stats = countNgrams(sentences, {
    top: flagNumber(flags, "top", 300),
    maxN: flagNumber(flags, "max-n", 4),
    minCount: flagNumber(flags, "min-count", 2),
    exclude,
  });
  const out: FrequencyFile = {
    subject_id: subjectId,
    generated_at: new Date().toISOString(),
    page_count: pages.pages.length,
    sentence_count: sentences.length,
    terms: stats.map((s) => ({
      term: s.term,
      n: s.n,
      count: s.count,
      df: s.df,
      examples: s.examples.map((sentence) => ({
        sentence,
        url: urlOf.get(sentence) ?? pages.roots[0] ?? "",
      })),
    })),
  };
  const file = path.join(workDir(subjectId), "frequency.json");
  await writeJson(file, out);
  console.log(
    `保存: ${file} (${out.terms.length} 語句 / ${out.sentence_count} 文)`,
  );
  console.log("上位 30:");
  for (const t of out.terms.slice(0, 30)) {
    console.log(`  ${String(t.df).padStart(5)}  ${t.term}`);
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
