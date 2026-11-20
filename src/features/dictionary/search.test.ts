import { describe, expect, it } from "vitest";
import type { Card } from "@/shared/content/schema";
import { buildDictionary, searchDictionary } from "./search";

const card = (
  target: string,
  meaning: string,
  subject: string,
  layer: Card["layer"],
  rank: number,
) =>
  ({
    target,
    meaning_ja: meaning,
    subject_id: subject,
    layer,
    frequency_rank: rank,
  }) as Card;

const entries = buildDictionary([
  card("deprecated", "非推奨の", "typescript", "vocab", 3),
  card("Deprecated", "非推奨(別の説明)", "nextjs", "vocab", 1),
  card("by default", "既定で", "nextjs", "pattern", 2),
  card("default export", "既定のエクスポート", "typescript", "system_term", 4),
  card("undefault", "テスト用", "typescript", "vocab", 5),
]);
const none = { layer: null, subjectId: null };

describe("buildDictionary", () => {
  it("同じ語句をまとめ、最も頻度順位の高いカードの表記と意味を使う", () => {
    const e = entries.find((x) => x.key === "deprecated");
    expect(e).toMatchObject({
      term: "Deprecated",
      meaning_ja: "非推奨(別の説明)",
      cardCount: 2,
    });
    expect(e?.subjectIds.sort()).toEqual(["nextjs", "typescript"]);
  });
});

describe("searchDictionary", () => {
  it("前方一致 > 語頭一致 > 部分一致 の順に並ぶ", () => {
    expect(
      searchDictionary(entries, "default", none).map((e) => e.key),
    ).toEqual(["default export", "by default", "undefault"]);
  });

  it("日本語の意味でも引ける", () => {
    expect(searchDictionary(entries, "非推奨", none).map((e) => e.key)).toEqual(
      ["deprecated"],
    );
  });

  it("大文字小文字・空白のゆれを無視する", () => {
    expect(
      searchDictionary(entries, "  BY   Def ", none).map((e) => e.key),
    ).toEqual(["by default"]);
  });

  it("層と題材で絞り込める", () => {
    expect(
      searchDictionary(entries, "default", {
        layer: "pattern",
        subjectId: null,
      }),
    ).toHaveLength(1);
    expect(
      searchDictionary(entries, "", { layer: null, subjectId: "nextjs" }).map(
        (e) => e.key,
      ),
    ).toEqual(["by default", "deprecated"]);
  });

  it("一致が無ければ空", () => {
    expect(searchDictionary(entries, "zzz", none)).toEqual([]);
  });
});
