import type { Metadata } from "next";
import { signOutAction } from "@/features/auth/actions";
import { requireUser } from "@/features/auth/require-user";
import { DeleteAccountButton } from "@/features/settings/DeleteAccountButton";
import { SettingsForm } from "@/features/settings/SettingsForm";
import { Button, LinkButton } from "@/shared/ui/Button";
import { PageHeader } from "@/shared/ui/PageHeader";
import { SiteCredit } from "@/shared/ui/SiteCredit";
import { Surface } from "@/shared/ui/Surface";
import { isDemoSource } from "@/infrastructure/repositories/data-source";

export const metadata: Metadata = { title: "設定" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user, repos } = await requireUser();
  const settings = await repos.learning.getSettings(user.id);

  return (
    <div className="space-y-6">
      <PageHeader title="設定" />
      <SettingsForm settings={settings} />

      <section className="space-y-3">
        <h2 className="text-sm font-medium">アカウント</h2>
        <Surface className="text-sm">
          <p className="font-medium">{user.displayName ?? "(表示名なし)"}</p>
          <p className="text-muted">
            {user.email ?? (isDemoSource(repos.source) ? "デモユーザー" : "")}
          </p>
          <p className="mt-2 text-xs text-muted">
            保存している個人情報はメールアドレス・表示名・プロフィール画像の URL
            です。アカウント削除で学習履歴を含む全データを消去します。
          </p>
        </Surface>
        <form action={signOutAction}>
          <Button type="submit" variant="secondary" full data-testid="sign-out">
            ログアウト
          </Button>
        </form>
        <DeleteAccountButton />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">このアプリについて</h2>
        <LinkButton href="/about" variant="secondary" full>
          使い方を見る
        </LinkButton>
      </section>

      <p className="text-center text-[11px] text-muted">
        data source: {repos.source}
      </p>
      <SiteCredit className="text-center" />
    </div>
  );
}
