import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readSupabaseEnv } from "./env";

/**
 * proxy.ts から呼ぶ: 期限切れのアクセストークンを更新し、更新後の Cookie をレスポンスへ書き戻す。
 * 認可判断はここでは行わない(各ページ / Server Function が requireUser() で確認する)。
 */
export async function refreshSupabaseSession(
  request: NextRequest,
): Promise<NextResponse> {
  const env = readSupabaseEnv();
  let response = NextResponse.next({ request });
  if (!env) return response;

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // getClaims() はトークンの検証と必要なら更新を行う(戻り値は使わない)
  await supabase.auth.getClaims();
  return response;
}
