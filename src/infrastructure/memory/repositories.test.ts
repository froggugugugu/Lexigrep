import { beforeEach, describe, expect, it } from "vitest";
import type { Card, Subject } from "@/shared/content/schema";
import { newSrsState } from "@/features/srs/scheduler";
import {
  MemoryContentRepository,
  MemoryLearningRepository,
} from "./repositories";
import { createEmptyData, type MemoryData } from "./store";

const T0 = "2026-01-01T00:00:00.000Z";
const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const subject = (id: string, published = true): Subject => ({
  id,
  name: id,
  category: "language_fw",
  description_ja: "x",
  official_urls: ["https://example.com/"],
  license_note: "",
  version: 1,
  crawled_at: null,
  is_published: published,
});

const card = (
  id: string,
  subjectId: string,
  layer: Card["layer"] = "vocab",
): Card => ({
  id: `${id}0000000-0000-4000-8000-000000000000`.slice(0, 36),
  subject_id: subjectId,
  layer,
  target: "w",
  sentence: "w",
  highlight: { start: 0, end: 1 },
  meaning_ja: "x",
  note_ja: null,
  question_type: "choose_meaning",
  prompt_ja: null,
  choices: { options: ["a", "b"], answer: 0 },
  frequency_rank: 1,
  related_card_ids: [],
  generated_by: "human",
  reviewed_by: null,
  status: "draft",
  sources: [
    {
      url: "https://example.com/",
      title: "t",
      fetched_at: T0,
      attribution: null,
    },
  ],
  created_at: T0,
  updated_at: T0,
});

let data: MemoryData;

beforeEach(() => {
  data = createEmptyData();
  data.subjects.set("typescript", subject("typescript"));
  data.subjects.set("hidden", subject("hidden", false));
  for (const c of [
    card("a", "typescript"),
    card("b", "typescript", "pattern"),
    card("c", "hidden"),
  ]) {
    data.cards.set(c.id, c);
  }
});

describe("MemoryContentRepository", () => {
  it("公開済み題材のカードだけを返し、題材・層で絞れる", async () => {
    const repo = new MemoryContentRepository(data);
    expect((await repo.listSubjects()).map((s) => s.id)).toEqual([
      "typescript",
    ]);
    expect((await repo.listCards()).map((c) => c.id.slice(0, 1))).toEqual([
      "a",
      "b",
    ]);
    expect(
      (await repo.listCards({ layer: "pattern" })).map((c) => c.id.slice(0, 1)),
    ).toEqual(["b"]);
    expect(await repo.getSubject("hidden")).toBeNull();
    expect(await repo.getCard(card("c", "hidden").id)).toBeNull();
  });
});

describe("MemoryLearningRepository", () => {
  it("SRS 状態はユーザーごとに分離され、コピーが保存される", async () => {
    const repo = new MemoryLearningRepository(data);
    const state = newSrsState(new Date(T0));
    const cardId = card("a", "typescript").id;
    await repo.upsertReviewState(USER, cardId, state);
    state.reps = 99;
    expect((await repo.getReviewStates(USER)).get(cardId)?.reps).toBe(0);
    expect((await repo.getReviewStates(OTHER)).size).toBe(0);
  });

  it("学習ログは新しい順に返し、since / limit で絞れる", async () => {
    const repo = new MemoryLearningRepository(data);
    const base = {
      started_at: T0,
      subject_id: null,
      layer: null,
      card_results: [],
    };
    await repo.addSessionLog(USER, {
      ...base,
      ended_at: "2026-01-01T00:00:00.000Z",
    });
    await repo.addSessionLog(USER, {
      ...base,
      ended_at: "2026-01-03T00:00:00.000Z",
    });
    await repo.addSessionLog(USER, {
      ...base,
      ended_at: "2026-01-02T00:00:00.000Z",
    });
    const all = await repo.listSessionLogs(USER);
    expect(all.map((l) => l.ended_at.slice(8, 10))).toEqual(["03", "02", "01"]);
    const since = await repo.listSessionLogs(USER, {
      since: new Date("2026-01-02T00:00:00.000Z"),
    });
    expect(since).toHaveLength(2);
    expect(await repo.listSessionLogs(USER, { limit: 1 })).toHaveLength(1);
    expect(await repo.listSessionLogs(OTHER)).toEqual([]);
  });

  it("設定は既定値から始まり、部分更新できる", async () => {
    const repo = new MemoryLearningRepository(data);
    expect(await repo.getSettings(USER)).toEqual({
      user_id: USER,
      session_size: 12,
      theme: "system",
      learning_goal: "general",
      focus_subject_id: null,
    });
    await repo.saveSettings(USER, { session_size: 16 });
    expect((await repo.getSettings(USER)).session_size).toBe(16);
    expect((await repo.getSettings(USER)).theme).toBe("system");
  });

  it("アカウント削除で本人のデータだけが消える", async () => {
    const repo = new MemoryLearningRepository(data);
    const cardId = card("a", "typescript").id;
    await repo.upsertReviewState(USER, cardId, newSrsState(new Date(T0)));
    await repo.upsertReviewState(OTHER, cardId, newSrsState(new Date(T0)));
    await repo.addCardReport(USER, cardId, "x");
    await repo.deleteAccount(USER);
    expect((await repo.getReviewStates(USER)).size).toBe(0);
    expect((await repo.getReviewStates(OTHER)).size).toBe(1);
    expect(data.reports).toEqual([]);
  });
});
