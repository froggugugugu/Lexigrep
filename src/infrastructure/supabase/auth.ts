import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AppUser, AuthGateway } from "@/infrastructure/repositories/types";

function readString(
  meta: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return null;
}

export function toAppUser(user: User): AppUser {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? null,
    displayName: readString(meta, ["full_name", "name", "preferred_username"]),
    avatarUrl: readString(meta, ["avatar_url", "picture"]),
  };
}

export class SupabaseAuthGateway implements AuthGateway {
  constructor(private readonly client: SupabaseClient) {}

  async getCurrentUser(): Promise<AppUser | null> {
    // getUser() は Auth サーバーでトークンを検証する(Cookie の値を信用しない)
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user) return null;
    return toAppUser(data.user);
  }

  async startSignIn(redirectTo: string): Promise<{ url: string }> {
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error || !data.url) {
      throw new Error(
        `Google ログインを開始できません: ${error?.message ?? "no url"}`,
      );
    }
    return { url: data.url };
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw new Error(`サインアウトに失敗しました: ${error.message}`);
  }
}
