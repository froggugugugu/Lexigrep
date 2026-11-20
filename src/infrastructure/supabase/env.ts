export type SupabaseEnv = { url: string; publishableKey: string };

/** NEXT_PUBLIC_ の 2 変数。未設定なら null(memory モードにフォールバックする判定に使う) */
export type EnvLike = Record<string, string | undefined>;

export function readSupabaseEnv(
  env: EnvLike = process.env,
): SupabaseEnv | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function requireSupabaseEnv(env: EnvLike = process.env): SupabaseEnv {
  const e = readSupabaseEnv(env);
  if (!e) {
    throw new Error(
      "Supabase の環境変数が未設定です: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  return e;
}
