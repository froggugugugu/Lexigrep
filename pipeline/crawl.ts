/**
 * 公式ドキュメントをクロールしてテキスト化する。
 *
 *   pnpm pipeline:crawl --subject typescript [--root https://...] [--max-pages 150] [--delay 1000] [--exclude-path release-notes]
 *
 * ルート URL は content/<subject>/subject.json の official_urls(--root で上書き可。
 * --root 指定時は subject.json が無くても動く)。
 * 出力: pipeline/work/<subject>/pages.json(gitignore 対象)
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { subjectSchema } from "../src/shared/content/schema";
import { flagNumber, flagString, parseArgs } from "./lib/args";
import { crawl } from "./lib/crawler";
import { workDir, writeJson, type PagesFile } from "./lib/work";

async function resolveRoots(
  subjectId: string,
  rootFlag: string | true | undefined,
): Promise<string[]> {
  if (typeof rootFlag === "string") return [rootFlag];
  const subjectFile = path.join(
    process.cwd(),
    "content",
    subjectId,
    "subject.json",
  );
  const subject = subjectSchema.parse(
    JSON.parse(await readFile(subjectFile, "utf8")),
  );
  return subject.official_urls;
}

async function main(): Promise<number> {
  const { flags } = parseArgs(process.argv.slice(2));
  const subjectId = flagString(flags, "subject", "");
  if (!subjectId) {
    console.error(
      "使い方: pnpm pipeline:crawl --subject <id> [--root url] [--max-pages 150] [--delay 1000]",
    );
    return 1;
  }
  const roots = await resolveRoots(subjectId, flags.get("root"));
  const maxPages = flagNumber(flags, "max-pages", 150);
  const delayMs = flagNumber(flags, "delay", 1000);
  const excludePaths = flagString(flags, "exclude-path", "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  console.log(
    `${subjectId}: roots=${roots.join(", ")} maxPages=${maxPages} delay=${delayMs}ms`,
  );
  const result = await crawl({
    roots,
    maxPages,
    delayMs,
    excludePaths,
    log: (l) => console.log(l),
  });
  const out: PagesFile = {
    subject_id: subjectId,
    crawled_at: new Date().toISOString(),
    roots,
    pages: result.pages,
    skipped: result.skipped,
  };
  const file = path.join(workDir(subjectId), "pages.json");
  await writeJson(file, out);
  const sentences = result.pages.reduce((n, p) => n + p.sentences.length, 0);
  console.log(
    `保存: ${file} (${result.pages.length} ページ / ${sentences} 文 / skipped ${result.skipped.length})`,
  );
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
