/**
 * content/<subject>/cards.jsonl の実文がクロール済みコーパスに存在するかを照合する。
 *
 *   pnpm pipeline:verify --subject typescript [--soft]
 *
 * 入力: pipeline/work/<subject>/pages.json(先に pipeline:crawl を実行)
 * 不一致があれば一覧を出して exit 1(--soft なら 0)。レビュー前の機械チェックに使う。
 */
import path from "node:path";
import { readPackage } from "../src/shared/content/package";
import { flagString, parseArgs } from "./lib/args";
import { corpusContains } from "./lib/text";
import { readPages } from "./lib/work";

async function main(): Promise<number> {
  const { flags } = parseArgs(process.argv.slice(2));
  const subjectId = flagString(flags, "subject", "");
  if (!subjectId) {
    console.error("使い方: pnpm pipeline:verify --subject <id> [--soft]");
    return 1;
  }
  const pkg = await readPackage(path.join(process.cwd(), "content", subjectId));
  const pages = await readPages(subjectId);
  const byUrl = new Map(pages.pages.map((p) => [p.url, p.sentences] as const));
  const all = pages.pages.flatMap((p) => p.sentences);

  const missing: {
    id: string;
    target: string;
    url: string;
    where: "none" | "other-page";
  }[] = [];
  for (const card of pkg.cards) {
    if (card.status === "retired") continue;
    const url = card.sources[0]?.url ?? "";
    const own = byUrl.get(url) ?? [];
    if (corpusContains(own, card.sentence)) continue;
    missing.push({
      id: card.id,
      target: card.target,
      url,
      where: corpusContains(all, card.sentence) ? "other-page" : "none",
    });
  }

  const checked = pkg.cards.filter((c) => c.status !== "retired").length;
  console.log(
    `${subjectId}: ${checked} 枚中 ${checked - missing.length} 枚が出典ページの実文と一致`,
  );
  for (const m of missing) {
    console.log(
      `  ✘ ${m.target} (${m.id.slice(0, 8)}) ${m.where === "other-page" ? "別ページには存在" : "コーパスに無い"}: ${m.url}`,
    );
  }
  return missing.length === 0 || flags.get("soft") === true ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
