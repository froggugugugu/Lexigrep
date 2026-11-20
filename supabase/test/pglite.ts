/**
 * テスト専用: PGlite(WASM の PostgreSQL)にマイグレーションを適用するヘルパー。
 * Supabase の auth スキーマ・ロールは auth-stub.sql で最小限に模す。
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const ROOT = path.resolve(__dirname, "..");

export async function listMigrationFiles(): Promise<string[]> {
  const dir = path.join(ROOT, "migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  return files.map((f) => path.join(dir, f));
}

/** マイグレーションを順に適用する。`until` を渡すとそのファイル名(例 "0002")より前で止める */
export async function createMigratedDb(
  options: { until?: string } = {},
): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(
    await readFile(path.join(ROOT, "test", "auth-stub.sql"), "utf8"),
  );
  for (const file of await listMigrationFiles()) {
    if (options.until && path.basename(file) >= options.until) break;
    await db.exec(await readFile(file, "utf8"));
  }
  return db;
}

/** 1 つのマイグレーションファイルを適用する */
export async function applyMigration(
  db: PGlite,
  prefix: string,
): Promise<void> {
  const file = (await listMigrationFiles()).find((f) =>
    path.basename(f).startsWith(prefix),
  );
  if (!file) throw new Error(`マイグレーションが見つかりません: ${prefix}`);
  await db.exec(await readFile(file, "utf8"));
}

/** 認証済みユーザーとして振る舞う(RLS 検証用) */
export async function actAs(db: PGlite, userId: string | null): Promise<void> {
  await db.exec("reset role");
  if (userId === null) {
    await db.exec("select set_config('request.jwt.claim.sub', '', false)");
    await db.exec("set role anon");
    return;
  }
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    userId,
  ]);
  await db.exec("set role authenticated");
}

export async function actAsAdmin(db: PGlite): Promise<void> {
  await db.exec("reset role");
  await db.exec("select set_config('request.jwt.claim.sub', '', false)");
}
