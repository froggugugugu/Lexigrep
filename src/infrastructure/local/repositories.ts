import type {
  SessionLog,
  SrsState,
  UserSettings,
} from "@/shared/content/schema";
import { MemoryLearningRepository } from "@/infrastructure/memory/repositories";
import type {
  LearningRepository,
  NewSessionLog,
  SessionLogQuery,
} from "@/infrastructure/repositories/types";
import type { LocalStore } from "./store";

/** memory の学習リポジトリに、書き込みのたびの保存を足したもの */
export class LocalLearningRepository implements LearningRepository {
  private readonly inner: MemoryLearningRepository;

  constructor(private readonly store: LocalStore) {
    this.inner = new MemoryLearningRepository(store.data);
  }

  getReviewStates(
    userId: string,
    cardIds?: readonly string[],
  ): Promise<Map<string, SrsState>> {
    return this.inner.getReviewStates(userId, cardIds);
  }

  async upsertReviewState(
    userId: string,
    cardId: string,
    state: SrsState,
  ): Promise<void> {
    await this.inner.upsertReviewState(userId, cardId, state);
    await this.store.persister.save();
  }

  listSessionLogs(
    userId: string,
    query?: SessionLogQuery,
  ): Promise<SessionLog[]> {
    return this.inner.listSessionLogs(userId, query);
  }

  async addSessionLog(userId: string, log: NewSessionLog): Promise<SessionLog> {
    const saved = await this.inner.addSessionLog(userId, log);
    await this.store.persister.save();
    return saved;
  }

  getSettings(userId: string): Promise<UserSettings> {
    return this.inner.getSettings(userId);
  }

  async saveSettings(
    userId: string,
    patch: Partial<Omit<UserSettings, "user_id">>,
  ): Promise<UserSettings> {
    const next = await this.inner.saveSettings(userId, patch);
    await this.store.persister.save();
    return next;
  }

  async addCardReport(
    userId: string,
    cardId: string,
    reason: string,
  ): Promise<void> {
    await this.inner.addCardReport(userId, cardId, reason);
    await this.store.persister.save();
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.inner.deleteAccount(userId);
    await this.store.persister.save();
  }
}
