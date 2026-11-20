/**
 * 題材パッケージの雛形(subject.json / 空の cards.jsonl / manifest.json)を作る。
 * `pnpm content:init` と skill `/author-subject` の両方から使う。
 */
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildManifest } from "../../src/shared/content/package";
import {
  subjectSchema,
  type Manifest,
  type Subject,
} from "../../src/shared/content/schema";

export type InitSubjectOptions = {
  id: string;
  name: string;
  category: string;
  categoryLabel?: string;
  description?: string;
  urls: string[];
  licenseNote?: string;
};

export type SubjectScaffold = {
  subject: Subject;
  cardsJsonl: string;
  manifest: Manifest;
};

/** 入力を検証して雛形を組み立てる(不正なら ZodError) */
export function buildSubjectScaffold(
  opts: InitSubjectOptions,
  now: Date,
): SubjectScaffold {
  const subject = subjectSchema.parse({
    id: opts.id,
    name: opts.name,
    category: opts.category,
    ...(opts.categoryLabel ? { category_label: opts.categoryLabel } : {}),
    description_ja: opts.description ?? `${opts.name} の公式ドキュメント`,
    official_urls: opts.urls,
    license_note: opts.licenseNote ?? "",
    version: 1,
    crawled_at: null,
    is_published: true,
  });
  const cardsJsonl = "";
  return {
    subject,
    cardsJsonl,
    manifest: buildManifest(subject, cardsJsonl, 0, "content:init", now),
  };
}

/** content/<id>/ に書き出す。既にあれば上書きせずに失敗する */
export async function writeSubjectScaffold(
  contentDir: string,
  scaffold: SubjectScaffold,
): Promise<string> {
  const dir = path.join(contentDir, scaffold.subject.id);
  const exists = await stat(dir).then(
    () => true,
    (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") return false;
      throw err;
    },
  );
  if (exists) {
    throw new Error(`既に題材があります(上書きしません): ${dir}`);
  }
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "subject.json"),
    `${JSON.stringify(scaffold.subject, null, 2)}\n`,
    "utf8",
  );
  await writeFile(path.join(dir, "cards.jsonl"), scaffold.cardsJsonl, "utf8");
  await writeFile(
    path.join(dir, "manifest.json"),
    `${JSON.stringify(scaffold.manifest, null, 2)}\n`,
    "utf8",
  );
  return dir;
}
