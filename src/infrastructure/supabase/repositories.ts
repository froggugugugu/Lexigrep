import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Card,
  SessionLog,
  SrsState,
  Subject,
  UserSettings,
} from "@/shared/content/schema";
import { DEFAULT_SESSION_SIZE } from "@/shared/content/schema";
import type {
  CardFilter,
  ContentRepository,
  LearningRepository,
  NewSessionLog,
  SessionLogQuery,
} from "@/infrastructure/repositories/types";
import {
  reviewStateToRow,
  rowToCard,
  rowToReviewState,
  rowToSessionLog,
  rowToSubject,
  rowToUserSettings,
} from "./rows";

const PAGE_SIZE = 1000;
const IN_CHUNK = 200;

function fail(context: string, error: { message: string } | null): never {
  // ユーザー ID やリクエスト本文を含めない(ログに個人情報を出さない)
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

export class SupabaseContentRepository implements ContentRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listSubjects(): Promise<Subject[]> {
    const { data, error } = await this.client
      .from("subjects")
      .select("*")
      .eq("is_published", true)
      .order("name");
    if (error) fail("subjects の取得", error);
    return (data ?? []).map(rowToSubject);
  }

  async getSubject(id: string): Promise<Subject | null> {
    const { data, error } = await this.client
      .from("subjects")
      .select("*")
      .eq("id", id)
      .eq("is_published", true)
      .maybeSingle();
    if (error) fail("subject の取得", error);
    return data ? rowToSubject(data) : null;
  }

  async listCards(filter?: CardFilter): Promise<Card[]> {
    const cards: Card[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      let q = this.client
        .from("cards")
        .select("*, card_sources(*)")
        .eq("status", "published")
        .order("subject_id")
        .order("frequency_rank")
        .order("id")
        .range(from, from + PAGE_SIZE - 1);
      if (filter?.subjectId) q = q.eq("subject_id", filter.subjectId);
      if (filter?.layer) q = q.eq("layer", filter.layer);
      const { data, error } = await q;
      if (error) fail("cards の取得", error);
      const rows = data ?? [];
      cards.push(...rows.map(rowToCard));
      if (rows.length < PAGE_SIZE) break;
    }
    return cards;
  }

  async getCard(id: string): Promise<Card | null> {
    const { data, error } = await this.client
      .from("cards")
      .select("*, card_sources(*)")
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle();
    if (error) fail("card の取得", error);
    return data ? rowToCard(data) : null;
  }

  async getCards(ids: readonly string[]): Promise<Card[]> {
    const out: Card[] = [];
    for (const part of chunk(ids, IN_CHUNK)) {
      const { data, error } = await this.client
        .from("cards")
        .select("*, card_sources(*)")
        .eq("status", "published")
        .in("id", part);
      if (error) fail("cards の取得", error);
      out.push(...(data ?? []).map(rowToCard));
    }
    const order = new Map(ids.map((id, i) => [id, i]));
    return out.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }
}

export class SupabaseLearningRepository implements LearningRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getReviewStates(
    userId: string,
    cardIds?: readonly string[],
  ): Promise<Map<string, SrsState>> {
    const out = new Map<string, SrsState>();
    const parts = cardIds ? chunk(cardIds, IN_CHUNK) : [null];
    for (const part of parts) {
      // PostgREST の既定上限(1000 行)で黙って切り捨てられないよう最後までページングする
      for (let from = 0; ; from += PAGE_SIZE) {
        let q = this.client
          .from("review_states")
          .select("*")
          .eq("user_id", userId)
          .order("card_id")
          .range(from, from + PAGE_SIZE - 1);
        if (part) q = q.in("card_id", part);
        const { data, error } = await q;
        if (error) fail("review_states の取得", error);
        const rows = data ?? [];
        for (const row of rows) {
          const { user_id: _u, card_id, ...state } = rowToReviewState(row);
          out.set(card_id, state);
        }
        if (rows.length < PAGE_SIZE) break;
      }
    }
    return out;
  }

  async upsertReviewState(
    userId: string,
    cardId: string,
    state: SrsState,
  ): Promise<void> {
    const { error } = await this.client
      .from("review_states")
      .upsert(reviewStateToRow(userId, cardId, state), {
        onConflict: "user_id,card_id",
      });
    if (error) fail("review_state の保存", error);
  }

  async listSessionLogs(
    userId: string,
    query?: SessionLogQuery,
  ): Promise<SessionLog[]> {
    let q = this.client
      .from("session_logs")
      .select("*")
      .eq("user_id", userId)
      .order("ended_at", { ascending: false });
    if (query?.since) q = q.gte("ended_at", query.since.toISOString());
    if (query?.limit !== undefined) q = q.limit(query.limit);
    const { data, error } = await q;
    if (error) fail("session_logs の取得", error);
    return (data ?? []).map(rowToSessionLog);
  }

  async addSessionLog(userId: string, log: NewSessionLog): Promise<SessionLog> {
    const { data, error } = await this.client
      .from("session_logs")
      .insert({ ...log, user_id: userId })
      .select("*")
      .single();
    if (error) fail("session_log の保存", error);
    return rowToSessionLog(data);
  }

  async getSettings(userId: string): Promise<UserSettings> {
    const { data, error } = await this.client
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) fail("user_settings の取得", error);
    return data
      ? rowToUserSettings(data)
      : {
          user_id: userId,
          session_size: DEFAULT_SESSION_SIZE,
          theme: "system",
          learning_goal: "general",
          focus_subject_id: null,
        };
  }

  async saveSettings(
    userId: string,
    patch: Partial<Omit<UserSettings, "user_id">>,
  ): Promise<UserSettings> {
    const current = await this.getSettings(userId);
    const next: UserSettings = { ...current, ...patch, user_id: userId };
    const { error } = await this.client
      .from("user_settings")
      .upsert(next, { onConflict: "user_id" });
    if (error) fail("user_settings の保存", error);
    return next;
  }

  async addCardReport(
    userId: string,
    cardId: string,
    reason: string,
  ): Promise<void> {
    const { error } = await this.client
      .from("card_reports")
      .insert({ user_id: userId, card_id: cardId, reason });
    if (error) fail("card_report の保存", error);
  }

  async deleteAccount(): Promise<void> {
    const { error } = await this.client.rpc("delete_my_account");
    if (error) fail("アカウント削除", error);
  }
}
