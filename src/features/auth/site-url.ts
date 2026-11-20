import "server-only";
import { headers } from "next/headers";

export { safeNextPath } from "./safe-path";

/** OAuth のリダイレクト先に使う自サイトの origin。NEXT_PUBLIC_SITE_URL があれば最優先 */
export async function getSiteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    // Host ヘッダーを信用して OAuth の redirectTo を組み立てない
    throw new Error("本番環境では NEXT_PUBLIC_SITE_URL を設定してください");
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
