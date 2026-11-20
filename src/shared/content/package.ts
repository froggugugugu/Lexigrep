/**
 * 題材パッケージ(content/<subject_id>/)の読み書き・検証。
 * Node 専用(fs を使う)。アプリ(src/app)からは import しない。
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  cardSchema,
  manifestSchema,
  subjectSchema,
  type Card,
  type Manifest,
  type Subject,
} from "./schema";

export type ContentPackage = {
  dir: string;
  subject: Subject;
  cards: Card[];
  manifest: Manifest | null;
};

export type ValidationIssue = {
  file: string;
  line: number | null;
  message: string;
};

export class ContentValidationError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super(
      `コンテンツ検証エラー ${issues.length} 件:\n` +
        issues
          .map(
            (i) =>
              `  ${i.file}${i.line !== null ? `:${i.line}` : ""} ${i.message}`,
          )
          .join("\n"),
    );
    this.name = "ContentValidationError";
  }
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** JSONL を 1 行ずつパースし、行番号付きで Zod 検証する */
export function parseCardsJsonl(
  text: string,
  file = "cards.jsonl",
): { cards: Card[]; issues: ValidationIssue[] } {
  const cards: Card[] = [];
  const issues: ValidationIssue[] = [];
  const lines = text.split("\n");
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (line === "") return;
    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch {
      issues.push({
        file,
        line: index + 1,
        message: "JSON として解釈できない",
      });
      return;
    }
    const r = cardSchema.safeParse(json);
    if (!r.success) {
      for (const e of r.error.issues) {
        issues.push({
          file,
          line: index + 1,
          message: `${e.path.join(".")}: ${e.message}`,
        });
      }
      return;
    }
    cards.push(r.data);
  });
  return { cards, issues };
}

/** パッケージ全体の整合性(id 重複・subject_id 一致・related 参照) */
export function validatePackage(
  subject: Subject,
  cards: Card[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  const keys = new Set<string>();
  for (const card of cards) {
    if (ids.has(card.id)) {
      issues.push({
        file: "cards.jsonl",
        line: null,
        message: `id 重複: ${card.id}`,
      });
    }
    ids.add(card.id);
    const key = `${card.layer}\u0000${card.target.toLowerCase()}\u0000${card.sentence}`;
    if (keys.has(key)) {
      issues.push({
        file: "cards.jsonl",
        line: null,
        message: `同じ層・語句・実文のカードが重複: ${card.target}`,
      });
    }
    keys.add(key);
    if (card.subject_id !== subject.id) {
      issues.push({
        file: "cards.jsonl",
        line: null,
        message: `subject_id 不一致: ${card.id} は ${card.subject_id}(期待: ${subject.id})`,
      });
    }
  }
  for (const card of cards) {
    for (const rel of card.related_card_ids) {
      if (!ids.has(rel)) {
        issues.push({
          file: "cards.jsonl",
          line: null,
          message: `related_card_ids の参照先が無い: ${card.id} → ${rel}`,
        });
      }
    }
  }
  return issues;
}

export function buildManifest(
  subject: Subject,
  cardsJsonl: string,
  cardCount: number,
  generator: string,
  now: Date,
): Manifest {
  return {
    subject_id: subject.id,
    version: subject.version,
    crawled_at: subject.crawled_at,
    card_count: cardCount,
    checksum: sha256Hex(cardsJsonl),
    generated_at: now.toISOString(),
    generator,
  };
}

export async function readPackage(dir: string): Promise<ContentPackage> {
  const issues: ValidationIssue[] = [];

  const subjectText = await readFile(path.join(dir, "subject.json"), "utf8");
  const subjectResult = subjectSchema.safeParse(JSON.parse(subjectText));
  if (!subjectResult.success) {
    for (const e of subjectResult.error.issues) {
      issues.push({
        file: "subject.json",
        line: null,
        message: `${e.path.join(".")}: ${e.message}`,
      });
    }
    throw new ContentValidationError(issues);
  }
  const subject = subjectResult.data;

  const cardsText = await readFile(path.join(dir, "cards.jsonl"), "utf8");
  const parsed = parseCardsJsonl(cardsText);
  issues.push(...parsed.issues);
  issues.push(...validatePackage(subject, parsed.cards));

  let manifest: Manifest | null = null;
  try {
    const manifestText = await readFile(
      path.join(dir, "manifest.json"),
      "utf8",
    );
    const m = manifestSchema.safeParse(JSON.parse(manifestText));
    if (!m.success) {
      for (const e of m.error.issues) {
        issues.push({
          file: "manifest.json",
          line: null,
          message: `${e.path.join(".")}: ${e.message}`,
        });
      }
    } else {
      manifest = m.data;
      if (manifest.subject_id !== subject.id) {
        issues.push({
          file: "manifest.json",
          line: null,
          message: "subject_id が subject.json と不一致",
        });
      }
      if (manifest.card_count !== parsed.cards.length) {
        issues.push({
          file: "manifest.json",
          line: null,
          message: `card_count 不一致: ${manifest.card_count}(実際: ${parsed.cards.length})`,
        });
      }
      if (manifest.checksum !== sha256Hex(cardsText)) {
        issues.push({
          file: "manifest.json",
          line: null,
          message: "checksum が cards.jsonl と不一致(manifest を再生成する)",
        });
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  if (issues.length > 0) throw new ContentValidationError(issues);
  return { dir, subject, cards: parsed.cards, manifest };
}

export async function writeManifest(
  dir: string,
  generator: string,
  now: Date,
): Promise<Manifest> {
  const subject = subjectSchema.parse(
    JSON.parse(await readFile(path.join(dir, "subject.json"), "utf8")),
  );
  const cardsText = await readFile(path.join(dir, "cards.jsonl"), "utf8");
  const parsed = parseCardsJsonl(cardsText);
  if (parsed.issues.length > 0) throw new ContentValidationError(parsed.issues);
  const manifest = buildManifest(
    subject,
    cardsText,
    parsed.cards.length,
    generator,
    now,
  );
  await writeFile(
    path.join(dir, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8",
  );
  return manifest;
}

export function serializeCards(cards: readonly Card[]): string {
  return cards.map((c) => JSON.stringify(c)).join("\n") + "\n";
}
