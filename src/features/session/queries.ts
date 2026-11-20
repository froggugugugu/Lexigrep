import "server-only";
import type { Repositories } from "@/infrastructure/repositories/types";
import { buildSession, type SessionFilter } from "./build-session";
import { loggedLayer } from "./course";
import { shuffledOrder } from "./shuffle";
import type { SessionPayload } from "./types";

export async function prepareSession(
  repos: Repositories,
  userId: string,
  filter: SessionFilter,
  sessionSize: number,
  now: Date,
): Promise<SessionPayload> {
  const [cards, states] = await Promise.all([
    repos.content.listCards({ subjectId: filter.subjectId }),
    repos.learning.getReviewStates(userId),
  ]);
  const plan = buildSession({ cards, states, filter, size: sessionSize, now });
  const startedAt = now.toISOString();
  return {
    cards: plan.cards.map((card) => ({
      card,
      optionOrder: shuffledOrder(
        `${card.id}:${startedAt}`,
        card.choices.options.length,
      ),
    })),
    startedAt,
    filter: { subjectId: filter.subjectId, layer: loggedLayer(filter) },
    dueCount: plan.dueCount,
    newCount: plan.newCount,
    estimatedMinutes: plan.estimatedMinutes,
  };
}
