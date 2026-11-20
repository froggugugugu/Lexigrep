"use client";

import { useActionState } from "react";
import { Button } from "@/shared/ui/Button";
import { reportCardAction, type ReportFormState } from "./actions";

export function ReportForm({ cardId }: { cardId: string }) {
  const [state, action, pending] = useActionState<ReportFormState, FormData>(
    reportCardAction,
    {
      message: null,
      error: null,
    },
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="cardId" value={cardId} />
      <label htmlFor="reason" className="block text-sm font-medium">
        間違い・不自然な点を報告
      </label>
      <textarea
        id="reason"
        name="reason"
        rows={3}
        maxLength={1000}
        required
        placeholder="例: 訳が文脈に合っていない / 出典の文と一致しない"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-accent"
      />
      <Button type="submit" variant="secondary" disabled={pending} full>
        {pending ? "送信中…" : "報告する"}
      </Button>
      {state.message ? (
        <p role="status" className="text-sm text-success">
          {state.message}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
