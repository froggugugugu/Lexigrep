/**
 * 題材パッケージの雛形を作る。
 *
 *   pnpm content:init --subject aws-s3 --name "Amazon S3" --category cloud \
 *     --url https://docs.aws.amazon.com/AmazonS3/latest/userguide/ \
 *     [--url <2 つ目のルート>] [--category-label ストレージ] [--description "..."] [--license-note "..."]
 *
 * 作ったあとは pipeline:crawl → frequency → author → content:validate --write-manifest → pipeline:verify
 * (手順は skill `/author-subject` と docs/development-patterns.md §9)。
 */
import path from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { buildSubjectScaffold, writeSubjectScaffold } from "./lib/init-subject";

const CONTENT_DIR = path.resolve(process.cwd(), "content");

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      subject: { type: "string" },
      name: { type: "string" },
      category: { type: "string" },
      url: { type: "string", multiple: true },
      "category-label": { type: "string" },
      description: { type: "string" },
      "license-note": { type: "string" },
    },
  });
  if (!values.subject || !values.name || !values.category || !values.url) {
    console.error(
      "使い方: pnpm content:init --subject <id> --name <表示名> --category <slug> --url <ルート URL> [--category-label <表示名>] [--description <説明>] [--license-note <引用方針>]",
    );
    return 1;
  }
  try {
    const scaffold = buildSubjectScaffold(
      {
        id: values.subject,
        name: values.name,
        category: values.category,
        categoryLabel: values["category-label"],
        description: values.description,
        urls: values.url,
        licenseNote: values["license-note"],
      },
      new Date(),
    );
    const dir = await writeSubjectScaffold(CONTENT_DIR, scaffold);
    console.log(`✔ ${path.relative(process.cwd(), dir)}/ を作りました`);
    if (!scaffold.subject.license_note) {
      console.log(
        "  ! license_note が空です。題材サイトの利用条件を確認して subject.json に書いてください",
      );
    }
    return 0;
  } catch (err) {
    console.error(
      err instanceof z.ZodError
        ? z.prettifyError(err)
        : err instanceof Error
          ? err.message
          : err,
    );
    return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
