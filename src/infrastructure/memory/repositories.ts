import { randomUUID } from "node:crypto";
import type {
  Card,
  SessionLog,
  SrsState,
  Subject,
  UserSettings,
} from "@/shared/content/schema";
import type {
  CardFilter,
  ContentRepository,
  LearningRepository,
  NewSessionLog,
  SessionLogQuery,
} from "@/infrastructure/repositories/types";
import { defaultSettings, type MemoryData } from "./store";

function matches(card: Card, filter: CardFilter | undefined): boolean {
  if (!filter) return true;
  if (filter.subjectId && card.subject_id !== filter.subjectId) return false;
  if (filter.layer && card.layer !== filter.layer) return false;
  return true;
}

export class MemoryContentRepository implements ContentRepository {
  constructor(private readonly data: MemoryData) {}

  async listSubjects(): Promise<Subject[]> {
    return [...this.data.subjects.values()].filter((s) => s.is_published);
  }

  async getSubject(id: string): Promise<Subject | null> {
    const s = this.data.subjects.get(id);
    return s && s.is_published ? s : null;
  }

  async listCards(filter?: CardFilter): Promise<Card[]> {
    return [...this.data.cards.values()].filter(
      (c) =>
        this.data.subjects.get(c.subject_id)?.is_published &&
        matches(c, filter),
    );
  }

  async getCard(id: string): Promise<Card | null> {
    const c = this.data.cards.get(id);
    return c && this.data.subjects.get(c.subject_id)?.is_published ? c : null;
  }

  async getCards(ids: readonly string[]): Promise<Card[]> {
    const out: Card[] = [];
    for (const id of ids) {
      const c = await this.getCard(id);
      if (c) out.push(c);
    }
    return out;
  }
}

export class MemoryLearningRepository implements LearningRepository {
  constructor(private readonly data: MemoryData) {}

  private statesOf(userId: string): Map<string, SrsState> {
    let m = this.data.reviewStates.get(userId);
    if (!m) {
      m = new Map();
      this.data.reviewStates.set(userId, m);
    }
    return m;
  }

  async getReviewStates(
    userId: string,
    cardIds?: readonly string[],
  ): Promise<Map<string, SrsState>> {
    const all = this.statesOf(userId);
    if (!cardIds) return new Map(all);
    const out = new Map<string, SrsState>();
    for (const id of cardIds) {
      const s = all.get(id);
      if (s) out.set(id, s);
    }
    return out;
  }

  async upsertReviewState(
    userId: string,
    cardId: string,
    state: SrsState,
  ): Promise<void> {
    this.statesOf(userId).set(cardId, structuredClone(state));
  }

  async listSessionLogs(
    userId: string,
    query?: SessionLogQuery,
  ): Promise<SessionLog[]> {
    let logs = [...(this.data.sessionLogs.get(userId) ?? [])];
    if (query?.since) {
      const since = query.since.getTime();
      logs = logs.filter((l) => new Date(l.ended_at).getTime() >= since);
    }
    logs.sort((a, b) => b.ended_at.localeCompare(a.ended_at));
    if (query?.limit !== undefined) logs = logs.slice(0, query.limit);
    return logs;
  }

  async addSessionLog(userId: string, log: NewSessionLog): Promise<SessionLog> {
    const saved: SessionLog = {
      ...structuredClone(log),
      id: randomUUID(),
      user_id: userId,
    };
    const list = this.data.sessionLogs.get(userId) ?? [];
    list.push(saved);
    this.data.sessionLogs.set(userId, list);
    return saved;
  }

  async getSettings(userId: string): Promise<UserSettings> {
    return this.data.settings.get(userId) ?? defaultSettings(userId);
  }

  async saveSettings(
    userId: string,
    patch: Partial<Omit<UserSettings, "user_id">>,
  ): Promise<UserSettings> {
    const next: UserSettings = {
      ...(await this.getSettings(userId)),
      ...patch,
      user_id: userId,
    };
    this.data.settings.set(userId, next);
    return next;
  }

  async addCardReport(
    userId: string,
    cardId: string,
    reason: string,
  ): Promise<void> {
    this.data.reports.push({
      user_id: userId,
      card_id: cardId,
      reason,
      created_at: new Date().toISOString(),
    });
  }

  async deleteAccount(userId: string): Promise<void> {
    this.data.reviewStates.delete(userId);
    this.data.sessionLogs.delete(userId);
    this.data.settings.delete(userId);
    this.data.reports = this.data.reports.filter((r) => r.user_id !== userId);
  }
}
