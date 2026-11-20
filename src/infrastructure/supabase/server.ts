import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { requireSupabaseEnv } from "./env";

/**
 * Server Component / Server Function / Route Handler 用のクライアント。
 * リクエストごとに生成する(共有しない)。Server Component からは Cookie を書けないため、
 * セッションの更新は src/proxy.ts が担う。
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const { url, publishableKey } = requireSupabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component のレンダリング中は Cookie を書けない。proxy.ts が更新する
        }
      },
    },
  });
}
