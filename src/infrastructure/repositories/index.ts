import "server-only";
import path from "node:path";
import { MemoryAuthGateway } from "@/infrastructure/memory/auth";
import {
  MemoryContentRepository,
  MemoryLearningRepository,
} from "@/infrastructure/memory/repositories";
import { getMemoryData } from "@/infrastructure/memory/store";
import { LocalLearningRepository } from "@/infrastructure/local/repositories";
import { getLocalStore } from "@/infrastructure/local/store";
import { SupabaseAuthGateway } from "@/infrastructure/supabase/auth";
import type { EnvLike } from "@/infrastructure/supabase/env";
import { resolveDataSource } from "./data-source";
import {
  SupabaseContentRepository,
  SupabaseLearningRepository,
} from "@/infrastructure/supabase/repositories";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import type { Repositories } from "./types";

export {
  isDemoSource,
  resolveDataSource,
  type DataSource,
} from "./data-source";

export function contentDir(env: EnvLike = process.env): string {
  return env.LEXIGREP_CONTENT_DIR ?? path.join(process.cwd(), "content");
}

/** local モードの学習データの保存先(既定 `.lexigrep/learning.json`) */
export function localDataFile(env: EnvLike = process.env): string {
  return (
    env.LEXIGREP_LOCAL_DATA ??
    path.join(process.cwd(), ".lexigrep", "learning.json")
  );
}

/** リクエストごとに呼ぶ(Supabase クライアントは共有しない) */
export async function getRepositories(): Promise<Repositories> {
  const source = resolveDataSource();
  if (source === "memory") {
    const data = await getMemoryData(contentDir());
    return {
      source,
      content: new MemoryContentRepository(data),
      learning: new MemoryLearningRepository(data),
      auth: new MemoryAuthGateway(),
    };
  }
  if (source === "local") {
    const store = await getLocalStore(contentDir(), localDataFile());
    return {
      source,
      content: new MemoryContentRepository(store.data),
      learning: new LocalLearningRepository(store),
      auth: new MemoryAuthGateway(),
    };
  }
  const client = await createSupabaseServerClient();
  return {
    source,
    content: new SupabaseContentRepository(client),
    learning: new SupabaseLearningRepository(client),
    auth: new SupabaseAuthGateway(client),
  };
}
