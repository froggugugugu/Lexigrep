import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signInAction } from "@/features/auth/actions";
import { getOptionalUser } from "@/features/auth/require-user";
import { safeNextPath } from "@/features/auth/safe-path";
import { isDemoSource } from "@/infrastructure/repositories/data-source";
import { siteConfig } from "@/shared/site/config";
import { Button } from "@/shared/ui/Button";
import { SiteCredit } from "@/shared/ui/SiteCredit";

export const metadata: Metadata = { title: "ログイン" };

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: "ログインの応答が不正でした。もう一度お試しください。",
  exchange_failed: "ログインを完了できませんでした。もう一度お試しください。",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { user, repos } = await getOptionalUser();
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (user) redirect(next);

  const errorMessage = params.error ? ERROR_MESSAGES[params.error] : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-5 pt-16 pb-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {siteConfig.name}
        </h1>
        <p className="mt-4 text-base leading-7 text-muted">
          {siteConfig.tagline}
        </p>
        <ul className="mt-6 space-y-2 text-sm text-muted">
          <li>
            ・ 題材 × 層(頻出単語 / 表現パターン / 慣用句 /
            題材特有語)で選んで学習
          </li>
          <li>・ 間隔反復(FSRS)で覚えていないカードだけを再出題</li>
          {repos.source === "supabase" ? (
            <li>・ 進捗はアカウントに保存され、端末をまたいで引き継げます</li>
          ) : null}
        </ul>
        <Link
          href="/about"
          data-testid="about-link"
          className="mt-6 inline-flex min-h-tap items-center gap-1 rounded-lg text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          使い方を見る
          <span aria-hidden="true">›</span>
        </Link>
      </div>

      <div className="space-y-3">
        {errorMessage ? (
          <p
            role="alert"
            className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {errorMessage}
          </p>
        ) : null}
        <form action={signInAction}>
          <input type="hidden" name="next" value={next} />
          {isDemoSource(repos.source) ? (
            <Button type="submit" size="lg" full data-testid="demo-sign-in">
              デモユーザーで始める
            </Button>
          ) : (
            <Button
              type="submit"
              size="lg"
              variant="secondary"
              full
              data-testid="google-sign-in"
            >
              <GoogleMark />
              Google でログイン
            </Button>
          )}
        </form>
        <p className="text-center text-xs text-muted">
          {repos.source === "memory"
            ? "デモモード: データはサーバー再起動で消えます"
            : repos.source === "local"
              ? "ローカル保存モード: 学習データはこの PC に保存されます"
              : "Google アカウントのメールアドレス・表示名・プロフィール画像の URL を保存します"}
        </p>
        <SiteCredit className="text-center" />
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.4 5.7c4.3-4 7.1-9.9 7.1-17.4z"
      />
      <path
        fill="#FBBC05"
        d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.7l7.9-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.4-5.7c-2.1 1.4-4.8 2.3-8.2 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}
