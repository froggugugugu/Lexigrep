import { LinkButton } from "@/shared/ui/Button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm text-muted">404</p>
      <h1 className="text-xl font-semibold">ページが見つかりません</h1>
      <LinkButton href="/" variant="secondary">
        ホームへ
      </LinkButton>
    </main>
  );
}
