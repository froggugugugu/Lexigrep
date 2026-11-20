"use server";

import { redirect } from "next/navigation";
import { getRepositories, isDemoSource } from "@/infrastructure/repositories";
import { getSiteOrigin, safeNextPath } from "./site-url";

/** ログイン開始。Supabase では Google の同意画面へ、memory / local では即ログインして next へ */
export async function signInAction(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get("next")?.toString());
  const repos = await getRepositories();
  const origin = await getSiteOrigin();
  const callback = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const { url } = await repos.auth.startSignIn(
    isDemoSource(repos.source) ? next : callback,
  );
  redirect(url);
}

export async function signOutAction(): Promise<void> {
  const repos = await getRepositories();
  await repos.auth.signOut();
  redirect("/login");
}
