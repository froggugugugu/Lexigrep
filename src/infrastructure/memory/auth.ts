import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import type { AppUser, AuthGateway } from "@/infrastructure/repositories/types";

export const DEMO_SESSION_COOKIE = "lexigrep-demo-session";

export const DEMO_USER: AppUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: null,
  displayName: "デモユーザー",
  avatarUrl: null,
};

// local モードの保存ファイルと同じ判定(z.uuid)にする。緩いと、読み直せない ID がファイルに書かれる
const isUuid = (v: string) => z.uuid().safeParse(v).success;

/**
 * memory モードの認証。Cookie の値(UUID)をそのままユーザー ID として扱う(デモ / E2E 用)。
 * 「デモユーザーで始める」は固定の DEMO_USER、E2E は test ごとに別の UUID を Cookie に入れて分離する。
 * Cookie の書き込みは Server Function / Route Handler からのみ可能。
 */
export class MemoryAuthGateway implements AuthGateway {
  async getCurrentUser(): Promise<AppUser | null> {
    const store = await cookies();
    const value = store.get(DEMO_SESSION_COOKIE)?.value;
    if (!value || !isUuid(value)) return null;
    return value === DEMO_USER.id
      ? DEMO_USER
      : { ...DEMO_USER, id: value.toLowerCase() };
  }

  async startSignIn(redirectTo: string): Promise<{ url: string }> {
    const store = await cookies();
    store.set(DEMO_SESSION_COOKIE, DEMO_USER.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return { url: redirectTo };
  }

  async signOut(): Promise<void> {
    const store = await cookies();
    store.delete(DEMO_SESSION_COOKIE);
  }
}
