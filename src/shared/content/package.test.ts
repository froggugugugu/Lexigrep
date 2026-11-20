// @vitest-environment node
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Card, Subject } from "./schema";
import {
  ContentValidationError,
  parseCardsJsonl,
  readPackage,
  sha256Hex,
  serializeCards,
  validatePackage,
  writeManifest,
} from "./package";

const subject: Subject = {
  id: "typescript",
  name: "TypeScript",
  category: "language_fw",
  description_ja: "型システムの語彙",
  official_urls: ["https://www.typescriptlang.org/docs/"],
  license_note: "",
  version: 1,
  crawled_at: null,
  is_published: true,
};

const card: Card = {
  id: "11111111-1111-4111-8111-111111111111",
  subject_id: "typescript",
  layer: "pattern",
  target: "is not assignable to",
  sentence: "Type 'string' is not assignable to type 'number'.",
  highlight: { start: 14, end: 34 },
  meaning_ja: "〜に代入できない",
  note_ja: null,
  question_type: "choose_meaning",
  prompt_ja: null,
  choices: { options: ["a", "b", "c", "d"], answer: 0 },
  frequency_rank: 1,
  related_card_ids: [],
  generated_by: "human",
  reviewed_by: null,
  status: "draft",
  sources: [
    {
      url: "https://www.typescriptlang.org/docs/handbook/2/everyday-types.html",
      title: "Everyday Types",
      fetched_at: "2026-11-01T00:00:00.000Z",
      attribution: null,
    },
  ],
  created_at: "2026-11-01T00:00:00.000Z",
  updated_at: "2026-11-01T00:00:00.000Z",
};

describe("parseCardsJsonl", () => {
  it("空行を無視し、不正な行は行番号付きで報告する", () => {
    const text = `${JSON.stringify(card)}\n\nnot json\n${JSON.stringify({ ...card, id: "bad" })}\n`;
    const r = parseCardsJsonl(text);
    expect(r.cards).toHaveLength(1);
    expect(r.issues.map((i) => i.line)).toEqual([3, 4]);
  });
});

describe("validatePackage", () => {
  it("id 重複・subject_id 不一致・壊れた related 参照を検出する", () => {
    const other = {
      ...card,
      id: "22222222-2222-4222-8222-222222222222",
      subject_id: "nextjs",
      target: "Type",
      highlight: { start: 0, end: 4 },
      related_card_ids: ["33333333-3333-4333-8333-333333333333"],
    };
    const issues = validatePackage(subject, [card, card, other]);
    expect(issues.map((i) => i.message)).toEqual([
      expect.stringContaining("id 重複"),
      expect.stringContaining("重複"),
      expect.stringContaining("subject_id 不一致"),
      expect.stringContaining("related_card_ids"),
    ]);
  });
});

describe("readPackage / writeManifest", () => {
  it("manifest を生成し、checksum と card_count が一致すれば読み込める", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "lexigrep-content-"));
    await writeFile(path.join(dir, "subject.json"), JSON.stringify(subject));
    await writeFile(path.join(dir, "cards.jsonl"), serializeCards([card]));

    const manifest = await writeManifest(
      dir,
      "test",
      new Date("2026-11-01T00:00:00.000Z"),
    );
    expect(manifest.card_count).toBe(1);
    expect(manifest.checksum).toBe(sha256Hex(serializeCards([card])));

    const pkg = await readPackage(dir);
    expect(pkg.cards).toHaveLength(1);
    expect(pkg.manifest?.checksum).toBe(manifest.checksum);
  });

  it("cards.jsonl を書き換えると checksum 不一致で失敗する", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "lexigrep-content-"));
    await writeFile(path.join(dir, "subject.json"), JSON.stringify(subject));
    await writeFile(path.join(dir, "cards.jsonl"), serializeCards([card]));
    await writeManifest(dir, "test", new Date());
    await writeFile(
      path.join(dir, "cards.jsonl"),
      serializeCards([{ ...card, meaning_ja: "変更" }]),
    );
    await expect(readPackage(dir)).rejects.toThrow(ContentValidationError);
  });
});
