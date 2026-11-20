/**
 * ローカル保存モード(clone して手元で使う人向け)。
 * 題材とカードは memory モードと同じく content/ から読み、学習データ(SRS 状態・ログ・設定・間違い報告)だけを
 * JSON ファイルに保存して再起動後も残す。認証はない(デモユーザー 1 人)ので手元専用。
 *
 * - 読めない / 壊れたファイルは上書きせずにエラーで止める(ユーザーデータを消さない)
 * - 保存は一時ファイル → rename で原子的に行い、書き込みは直列化する(1 プロセス専用。同じファイルを 2 つのサーバーで使わない)
 * - 保存ファイルは学習データのスキーマで厳格に検証する。スキーマに項目を足すときは optional + 既定値にする
 */
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  sessionLogSchema,
  srsStateSchema,
  userSettingsSchema,
} from "@/shared/content/schema";
import {
  createEmptyData,
  loadContentDir,
  type MemoryData,
} from "@/infrastructure/memory/store";

const reportSchema = z.object({
  user_id: z.uuid(),
  card_id: z.uuid(),
  reason: z.string().min(1).max(1000),
  created_at: z.iso.datetime({ offset: true }),
});

export const localFileSchema = z.object({
  version: z.literal(1),
  review_states: z.record(z.uuid(), z.record(z.uuid(), srsStateSchema)),
  session_logs: z.record(z.uuid(), z.array(sessionLogSchema)),
  settings: z.record(z.uuid(), userSettingsSchema),
  reports: z.array(reportSchema),
});
export type LocalFile = z.infer<typeof localFileSchema>;

type LearningPart = Pick<
  MemoryData,
  "reviewStates" | "sessionLogs" | "settings" | "reports"
>;

export function toLocalFile(data: LearningPart): LocalFile {
  return {
    version: 1,
    review_states: Object.fromEntries(
      [...data.reviewStates].map(([u, m]) => [u, Object.fromEntries(m)]),
    ),
    session_logs: Object.fromEntries(data.sessionLogs),
    settings: Object.fromEntries(data.settings),
    reports: data.reports,
  };
}

export function fromLocalFile(file: LocalFile): LearningPart {
  return {
    reviewStates: new Map(
      Object.entries(file.review_states).map(([u, m]) => [
        u,
        new Map(Object.entries(m)),
      ]),
    ),
    sessionLogs: new Map(Object.entries(file.session_logs)),
    settings: new Map(Object.entries(file.settings)),
    reports: file.reports,
  };
}

/** 保存ファイルを読む。無ければ null。壊れていたら例外(ファイルには触らない) */
export async function readLocalFile(file: string): Promise<LocalFile | null> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `学習データ ${file} が JSON として読めません。ファイルを直すか退避してから起動してください(上書きはしません)`,
    );
  }
  const parsed = localFileSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `学習データ ${file} の形式が不正です(上書きはしません): ${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}

/** 一時ファイルに書いてから rename する(途中で落ちても元のファイルは壊れない) */
export async function writeLocalFile(
  file: string,
  data: LocalFile,
): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    await rename(tmp, file);
  } catch (err) {
    await rm(tmp, { force: true });
    throw new Error(
      `学習データ ${file} の保存に失敗しました(直前の回答は再起動後に残りません)`,
      { cause: err },
    );
  }
}

/** 1 つのファイルへの保存を直列化する。保存のたびに呼び出し時点の最新状態を書く */
export class LocalPersister {
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly file: string,
    private readonly data: LearningPart,
  ) {}

  save(): Promise<void> {
    const run = this.queue.then(() =>
      writeLocalFile(this.file, toLocalFile(this.data)),
    );
    // 失敗しても後続の保存は続ける(失敗は呼び出し元に返す)
    this.queue = run.catch(() => undefined);
    return run;
  }
}

export type LocalStore = { data: MemoryData; persister: LocalPersister };

export async function openLocalStore(
  contentDir: string,
  file: string,
): Promise<LocalStore> {
  const saved = await readLocalFile(file);
  const data = createEmptyData();
  const content = await loadContentDir(contentDir);
  data.subjects = content.subjects;
  data.cards = content.cards;
  if (saved) Object.assign(data, fromLocalFile(saved));
  return { data, persister: new LocalPersister(file, data) };
}

// dev サーバーのモジュール再評価で 2 つ目のストアができないよう globalThis に退避する
const GLOBAL_KEY = Symbol.for("lexigrep.localStore");

type GlobalStore = { file: string; loading: Promise<LocalStore> } | undefined;

export function getLocalStore(
  contentDir: string,
  file: string,
): Promise<LocalStore> {
  const g = globalThis as unknown as Record<symbol, GlobalStore>;
  const current = g[GLOBAL_KEY];
  if (current && current.file === file) return current.loading;
  const loading = openLocalStore(contentDir, file).catch((err: unknown) => {
    g[GLOBAL_KEY] = undefined; // 失敗した Promise をキャッシュしない
    throw err;
  });
  g[GLOBAL_KEY] = { file, loading };
  return loading;
}
