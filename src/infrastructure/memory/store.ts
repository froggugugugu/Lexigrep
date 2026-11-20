/**
 * メモリ内データストア(デモ / E2E 用)。
 * プロセス内で 1 つを共有し、再起動で消える。Supabase と同じ振る舞い(公開済みのみ・本人のみ)を
 * できる範囲で模倣するが、カードは draft も含めて見せる(レビュー前の内容を確認する用途のため)。
 */
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { readPackage } from "@/shared/content/package";
import {
  DEFAULT_SESSION_SIZE,
  type Card,
  type SessionLog,
  type SrsState,
  type Subject,
  type UserSettings,
} from "@/shared/content/schema";

export type MemoryData = {
  subjects: Map<string, Subject>;
  cards: Map<string, Card>;
  reviewStates: Map<string, Map<string, SrsState>>; // userId → cardId → state
  sessionLogs: Map<string, SessionLog[]>; // userId → logs
  settings: Map<string, UserSettings>;
  reports: {
    user_id: string;
    card_id: string;
    reason: string;
    created_at: string;
  }[];
};

export function createEmptyData(): MemoryData {
  return {
    subjects: new Map(),
    cards: new Map(),
    reviewStates: new Map(),
    sessionLogs: new Map(),
    settings: new Map(),
    reports: [],
  };
}

export function defaultSettings(userId: string): UserSettings {
  return {
    user_id: userId,
    session_size: DEFAULT_SESSION_SIZE,
    theme: "system",
    learning_goal: "general",
    focus_subject_id: null,
  };
}

/** content/<subject_id>/ をすべて読み込む(retired 以外を採用。検証に失敗した題材は除外してログに出す) */
export async function loadContentDir(
  contentDir: string,
): Promise<Pick<MemoryData, "subjects" | "cards">> {
  const subjects = new Map<string, Subject>();
  const cards = new Map<string, Card>();
  let entries: string[] = [];
  try {
    entries = await readdir(contentDir);
  } catch {
    return { subjects, cards };
  }
  for (const entry of entries.sort()) {
    const dir = path.join(contentDir, entry);
    if (!(await stat(dir)).isDirectory()) continue;
    let pkg: Awaited<ReturnType<typeof readPackage>>;
    try {
      pkg = await readPackage(dir);
    } catch (err) {
      // 執筆途中の題材が 1 つ壊れていても、他の題材で学習を続けられるようにする
      console.error(
        `[lexigrep] 題材 ${entry} を読み込めないため除外しました(pnpm content:validate ${entry} で確認):`,
        err instanceof Error ? err.message : err,
      );
      continue;
    }
    if (!pkg.subject.is_published) continue;
    subjects.set(pkg.subject.id, pkg.subject);
    for (const card of pkg.cards) {
      if (card.status === "retired") continue;
      cards.set(card.id, card);
    }
  }
  return { subjects, cards };
}

// Next.js の dev サーバーはモジュールを再評価することがあるため globalThis に退避する
const GLOBAL_KEY = Symbol.for("lexigrep.memoryStore");

type GlobalStore = {
  data: MemoryData | null;
  loading: Promise<MemoryData> | null;
};

function globalStore(): GlobalStore {
  const g = globalThis as unknown as Record<symbol, GlobalStore | undefined>;
  g[GLOBAL_KEY] ??= { data: null, loading: null };
  return g[GLOBAL_KEY];
}

export async function getMemoryData(contentDir: string): Promise<MemoryData> {
  const store = globalStore();
  if (store.data) return store.data;
  store.loading ??= (async () => {
    const data = createEmptyData();
    const content = await loadContentDir(contentDir);
    data.subjects = content.subjects;
    data.cards = content.cards;
    store.data = data;
    return data;
  })().catch((err: unknown) => {
    store.loading = null; // 失敗した Promise をキャッシュしない
    throw err;
  });
  return store.loading;
}

/** テスト用: ストアを破棄する */
export function resetMemoryData(): void {
  const store = globalStore();
  store.data = null;
  store.loading = null;
}
