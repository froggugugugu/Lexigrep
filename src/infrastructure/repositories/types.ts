/**
 * リポジトリ層のインターフェース。
 * UI(src/app, src/features)はこのインターフェースだけに依存し、Supabase を直接呼ばない。
 * 実装は memory(デモ / E2E)と supabase(本番)の 2 種(ADR-0001)。local は memory に保存を足したもの。
 */
import type {
  Card,
  Layer,
  SessionLog,
  SrsState,
  Subject,
  UserSettings,
} from "@/shared/content/schema";
import type { DataSource } from "./data-source";

export type AppUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

export type CardFilter = {
  subjectId?: string | null;
  layer?: Layer | null;
};

export interface ContentRepository {
  /** 公開済みの題材 */
  listSubjects(): Promise<Subject[]>;
  getSubject(id: string): Promise<Subject | null>;
  /** 公開済みカード(出典込み)。filter 未指定なら全題材 */
  listCards(filter?: CardFilter): Promise<Card[]>;
  getCard(id: string): Promise<Card | null>;
  getCards(ids: readonly string[]): Promise<Card[]>;
}

export type NewSessionLog = Omit<SessionLog, "id" | "user_id">;

export type SessionLogQuery = {
  /** この日時以降に終了したログだけ(省略時は全件) */
  since?: Date;
  limit?: number;
};

export interface LearningRepository {
  /** ユーザーの SRS 状態(card_id → state)。cardIds 指定で絞る */
  getReviewStates(
    userId: string,
    cardIds?: readonly string[],
  ): Promise<Map<string, SrsState>>;
  upsertReviewState(
    userId: string,
    cardId: string,
    state: SrsState,
  ): Promise<void>;
  listSessionLogs(
    userId: string,
    query?: SessionLogQuery,
  ): Promise<SessionLog[]>;
  addSessionLog(userId: string, log: NewSessionLog): Promise<SessionLog>;
  getSettings(userId: string): Promise<UserSettings>;
  saveSettings(
    userId: string,
    patch: Partial<Omit<UserSettings, "user_id">>,
  ): Promise<UserSettings>;
  addCardReport(userId: string, cardId: string, reason: string): Promise<void>;
  /** ユーザーの全データを削除(アカウント削除) */
  deleteAccount(userId: string): Promise<void>;
}

export interface AuthGateway {
  getCurrentUser(): Promise<AppUser | null>;
  /** Google OAuth の開始。遷移先 URL を返す(memory では即ログインして元の URL を返す) */
  startSignIn(redirectTo: string): Promise<{ url: string }>;
  signOut(): Promise<void>;
}

export type Repositories = {
  content: ContentRepository;
  learning: LearningRepository;
  auth: AuthGateway;
  /** 画面でデータソースを表示するため */
  source: DataSource;
};
