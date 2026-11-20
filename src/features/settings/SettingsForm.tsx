"use client";

import { useActionState } from "react";
import {
  SESSION_SIZES,
  THEMES,
  type Theme,
  type UserSettings,
} from "@/shared/content/schema";
import { Button } from "@/shared/ui/Button";
import { estimateMinutes } from "@/features/session/build-session";
import { saveSettingsAction, type SettingsFormState } from "./actions";

const THEME_LABELS: Record<Theme, string> = {
  system: "端末の設定に従う",
  dark: "ダーク",
  light: "ライト",
};

export function SettingsForm({ settings }: { settings: UserSettings }) {
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(
    saveSettingsAction,
    {
      message: null,
      error: null,
    },
  );

  return (
    <form action={action} className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">1 セッションの枚数</legend>
        <div className="grid grid-cols-4 gap-2">
          {SESSION_SIZES.map((n) => (
            <label
              key={n}
              className="flex min-h-tap cursor-pointer flex-col items-center justify-center rounded-lg border border-border bg-surface px-2 py-2 text-sm has-checked:border-accent has-checked:bg-accent/10"
            >
              <input
                type="radio"
                name="session_size"
                value={n}
                defaultChecked={settings.session_size === n}
                className="sr-only"
              />
              <span className="text-base font-semibold tabular-nums">
                {n}枚
              </span>
              <span className="text-[11px] text-muted">
                約{estimateMinutes(n)}分
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">テーマ</legend>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => (
            <label
              key={t}
              className="flex min-h-tap cursor-pointer items-center justify-center rounded-lg border border-border bg-surface px-2 py-2 text-sm has-checked:border-accent has-checked:bg-accent/10"
            >
              <input
                type="radio"
                name="theme"
                value={t}
                defaultChecked={settings.theme === t}
                className="sr-only"
              />
              {THEME_LABELS[t]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Button type="submit" size="lg" full disabled={pending}>
          {pending ? "保存中…" : "保存"}
        </Button>
        {state.message ? (
          <p role="status" className="text-center text-sm text-success">
            {state.message}
          </p>
        ) : null}
        {state.error ? (
          <p role="alert" className="text-center text-sm text-danger">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
