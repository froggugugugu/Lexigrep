import type { NextRequest } from "next/server";
import { refreshSupabaseSession } from "@/infrastructure/supabase/proxy-session";

/**
 * Supabase セッション(Cookie)の更新だけを行う。
 * 認可は各ページ / Server Function の requireUser() が担う(proxy の matcher 漏れに依存しない)。
 */
export async function proxy(request: NextRequest) {
  return refreshSupabaseSession(request);
}

export const config = {
  matcher: [
    // 静的アセット・画像最適化・manifest・アイコンは除外
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon/|apple-icon|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
