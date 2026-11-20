/** pipeline/work/<subject>/ の入出力(クロール結果・頻度表) */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NgramStat, PageText } from "./text";

export type PagesFile = {
  subject_id: string;
  crawled_at: string;
  roots: string[];
  pages: PageText[];
  skipped: { url: string; reason: string }[];
};

export type TermEntry = Omit<NgramStat, "examples"> & {
  examples: { sentence: string; url: string }[];
};

export type FrequencyFile = {
  subject_id: string;
  generated_at: string;
  page_count: number;
  sentence_count: number;
  terms: TermEntry[];
};

export function workDir(subjectId: string, root = process.cwd()): string {
  return path.join(root, "pipeline", "work", subjectId);
}

export async function writeJson(file: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

export async function readPages(
  subjectId: string,
  root = process.cwd(),
): Promise<PagesFile> {
  return readJson<PagesFile>(path.join(workDir(subjectId, root), "pages.json"));
}

export async function readFrequency(
  subjectId: string,
  root = process.cwd(),
): Promise<FrequencyFile> {
  return readJson<FrequencyFile>(
    path.join(workDir(subjectId, root), "frequency.json"),
  );
}
