"use client";

import { Button } from "@/shared/ui/Button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm text-danger">error</p>
      <h1 className="text-xl font-semibold">問題が発生しました</h1>
      <p className="text-sm text-muted">時間をおいてもう一度お試しください。</p>
      <Button variant="secondary" onClick={reset}>
        再試行
      </Button>
    </main>
  );
}
