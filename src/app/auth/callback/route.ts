import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { safeNextPath } from "@/features/auth/safe-path";

/** Google OAuth(PKCE)のコールバック。code をセッションに交換して next へ */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // エラー内容はログにもユーザーにも詳細を出さない(PII / トークン混入防止)
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
