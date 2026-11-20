"use client";

import { useTransition } from "react";
import { Button } from "@/shared/ui/Button";
import { deleteAccountAction } from "./actions";

export function DeleteAccountButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="danger"
      full
      disabled={pending}
      onClick={() => {
        if (
          !window.confirm(
            "学習履歴・設定を含むすべてのデータを削除します。元に戻せません。よろしいですか?",
          )
        )
          return;
        startTransition(() => deleteAccountAction());
      }}
    >
      {pending ? "削除中…" : "アカウントとデータを削除"}
    </Button>
  );
}
