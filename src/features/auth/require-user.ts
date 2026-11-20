import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getRepositories as buildRepositories } from "@/infrastructure/repositories";
import type {
  AppUser,
  Repositories,
} from "@/infrastructure/repositories/types";

export type AuthedContext = { user: AppUser; repos: Repositories };

/** 同じリクエスト内(generateMetadata と page など)で Auth サーバーへの往復を 1 回にする */
const getRepositories = cache(() => buildRepositories());
const getCurrentUser = cache(async () =>
  (await getRepositories()).auth.getCurrentUser(),
);

/** ログイン済みでなければ /login へ。各ページ・Server Function の先頭で呼ぶ */
export async function requireUser(): Promise<AuthedContext> {
  const repos = await getRepositories();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return { user, repos };
}

export async function getOptionalUser(): Promise<
  AuthedContext | { user: null; repos: Repositories }
> {
  const repos = await getRepositories();
  const user = await getCurrentUser();
  return { user, repos };
}
