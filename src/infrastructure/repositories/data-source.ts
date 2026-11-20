/**
 * データソースの決定(純粋関数。server-only を含まないのでテストできる)。
 *
 *   LEXIGREP_DATA_SOURCE=supabase|memory|local を最優先。
 *   未指定なら Supabase の環境変数があれば supabase、無ければ memory。
 *   local は memory と同じ認証なしのデモユーザーで、学習データだけをファイルに保存する(手元専用)。
 *   本番(NODE_ENV=production)では memory / local を既定で拒否する(認証なしのデモ経路が本番で開かないため)。
 *   本番で意図的に使う(プレビュー・手元の本番ビルド等)なら LEXIGREP_ALLOW_MEMORY=1 を明示する。
 */
import { readSupabaseEnv, type EnvLike } from "@/infrastructure/supabase/env";

export type DataSource = "memory" | "local" | "supabase";

/** 認証なしのデモユーザーで動くデータソースか */
export function isDemoSource(source: DataSource): boolean {
  return source === "memory" || source === "local";
}

export function resolveDataSource(env: EnvLike = process.env): DataSource {
  const explicit = env.LEXIGREP_DATA_SOURCE;
  let source: DataSource;
  if (
    explicit === "supabase" ||
    explicit === "memory" ||
    explicit === "local"
  ) {
    source = explicit;
  } else if (explicit !== undefined && explicit !== "") {
    throw new Error(
      `LEXIGREP_DATA_SOURCE は supabase / memory / local のいずれか: ${explicit}`,
    );
  } else {
    source = readSupabaseEnv(env) ? "supabase" : "memory";
  }

  if (
    isDemoSource(source) &&
    env.NODE_ENV === "production" &&
    env.LEXIGREP_ALLOW_MEMORY !== "1"
  ) {
    throw new Error(
      `本番環境で ${source} モード(認証なしのデモ)は無効です。Supabase の環境変数を設定するか、意図的なら LEXIGREP_ALLOW_MEMORY=1 を指定してください`,
    );
  }
  if (source === "supabase" && !readSupabaseEnv(env)) {
    throw new Error(
      "LEXIGREP_DATA_SOURCE=supabase ですが NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY が未設定です",
    );
  }
  return source;
}
