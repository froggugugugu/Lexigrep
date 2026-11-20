// @vitest-environment node
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SrsState } from "@/shared/content/schema";
import { LocalLearningRepository } from "./repositories";
import { openLocalStore, readLocalFile } from "./store";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CARD = "11111111-1111-4111-8111-111111111111";

const state = (reps: number): SrsState => ({
  stability: 1,
  difficulty: 5,
  due_at: "2026-11-04T00:00:00.000Z",
  last_reviewed_at: "2026-11-03T00:00:00.000Z",
  reps,
  lapses: 0,
  state: "learning",
  stability_fast: 0,
  scheduled_days: 1,
  learning_step: 0,
});

let dir: string;
let file: string;
let contentDir: string;

async function open() {
  const store = await openLocalStore(contentDir, file);
  return new LocalLearningRepository(store);
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "lexigrep-local-"));
  file = path.join(dir, "data", "learning.json");
  contentDir = path.join(dir, "content"); // 無いディレクトリ = 題材 0 件
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("local モードの保存", () => {
  it("ファイルが無ければ空で始まり、書いた内容が別インスタンスで読み直せる", async () => {
    const repo = await open();
    expect((await repo.getReviewStates(USER)).size).toBe(0);

    await repo.upsertReviewState(USER, CARD, state(1));
    await repo.saveSettings(USER, { session_size: 16 });
    await repo.addSessionLog(USER, {
      started_at: "2026-11-03T00:00:00.000Z",
      ended_at: "2026-11-03T00:03:00.000Z",
      subject_id: null,
      layer: null,
      card_results: [{ card_id: CARD, correct: true, elapsed_ms: 1000 }],
    });
    await repo.addCardReport(USER, CARD, "訳が違う");

    const reopened = await open();
    expect((await reopened.getReviewStates(USER)).get(CARD)).toEqual(state(1));
    expect((await reopened.getSettings(USER)).session_size).toBe(16);
    expect(await reopened.listSessionLogs(USER)).toHaveLength(1);
    expect((await readLocalFile(file))?.reports).toHaveLength(1);
  });

  it("壊れた JSON はエラーで止め、ファイルを書き換えない", async () => {
    await (await open()).upsertReviewState(USER, CARD, state(1));
    await writeFile(file, "{ broken", "utf8");
    await expect(open()).rejects.toThrow(/上書きはしません/);
    expect(await readFile(file, "utf8")).toBe("{ broken");
  });

  it("形式が不正なファイルもエラーで止める", async () => {
    await (await open()).upsertReviewState(USER, CARD, state(1));
    await writeFile(file, JSON.stringify({ version: 2 }), "utf8");
    await expect(open()).rejects.toThrow(/形式が不正/);
  });

  it("同時に書き込んでも全件が残り、一時ファイルが残らない", async () => {
    const repo = await open();
    const ids = Array.from(
      { length: 10 },
      (_, i) => `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`,
    );
    await Promise.all(
      ids.map((id, i) => repo.upsertReviewState(USER, id, state(i))),
    );
    const reopened = await open();
    expect((await reopened.getReviewStates(USER)).size).toBe(10);
    expect(
      (await readdir(path.dirname(file))).filter((f) => f.endsWith(".tmp")),
    ).toEqual([]);
  });

  it("アカウント削除は本人の分だけを消して保存する", async () => {
    const repo = await open();
    await repo.upsertReviewState(USER, CARD, state(1));
    await repo.upsertReviewState(OTHER, CARD, state(2));
    await repo.deleteAccount(USER);

    const reopened = await open();
    expect((await reopened.getReviewStates(USER)).size).toBe(0);
    expect((await reopened.getReviewStates(OTHER)).get(CARD)).toEqual(state(2));
  });

  it("壊れた題材があっても他の学習データで起動できる", async () => {
    await mkdir(path.join(contentDir, "broken"), { recursive: true });
    await writeFile(path.join(contentDir, "broken", "subject.json"), "{}");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const store = await openLocalStore(contentDir, file);
    expect(store.data.subjects.size).toBe(0);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("broken"),
      expect.anything(),
    );
    spy.mockRestore();
  });
});
