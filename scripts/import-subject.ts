/**
 * 題材パッケージを Supabase へ投入する(manifest 検証 → upsert)。
 *
 *   pnpm content:import <subject_id> [--dry-run] [--force]
 *
 * 必要な環境変数(アプリには渡さない。CI の secrets か .env.local に置く):
 *   SUPABASE_URL(または NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY   … RLS をバイパスして書き込む
 *
 * 振る舞い:
 * - 題材(subject)は常に upsert する(説明や公開フラグだけの変更も反映)
 * - 同じ checksum が content_imports に記録済みならカードはスキップ(--force で再投入)
 * - 出典は (card_id, url) で upsert してから不要分だけ削除する(途中で失敗しても出典 0 件にならない)
 * - パッケージから消えたカードは draft なら削除、それ以外は retired(学習履歴を残す)
 */
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readPackage } from "../src/shared/content/package";
import { cardToRows } from "../src/infrastructure/supabase/rows";
import {
  planImport,
  planSourceDeletes,
  type ExistingCardRow,
} from "./lib/import-plan";

const CHUNK = 200;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

function createAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchAll<T>(
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  context: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error) throw new Error(`${context}: ${error.message}`);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const subjectId = args.find((a) => !a.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");
  if (!subjectId) {
    console.error(
      "使い方: pnpm content:import <subject_id> [--dry-run] [--force]",
    );
    return 1;
  }

  const dir = path.resolve(process.cwd(), "content", subjectId);
  const pkg = await readPackage(dir);
  if (!pkg.manifest) {
    console.error(
      "manifest.json がありません。先に `pnpm content:validate --write-manifest` を実行してください",
    );
    return 1;
  }
  const { subject, cards, manifest } = pkg;
  console.log(
    `${subject.id} v${manifest.version}: ${cards.length} 枚 (checksum ${manifest.checksum.slice(0, 12)}…)`,
  );

  if (dryRun) {
    console.log("--dry-run: 検証のみ。書き込みは行いません");
    return 0;
  }

  const db = createAdminClient();

  const subjectUpsert = await db
    .from("subjects")
    // 表示名を subject.json から消したときに DB の古い値が残らないよう null を明示する
    .upsert(
      { ...subject, category_label: subject.category_label ?? null },
      { onConflict: "id" },
    );
  if (subjectUpsert.error)
    throw new Error(
      `subjects の upsert に失敗: ${subjectUpsert.error.message}`,
    );

  if (!force) {
    const { data, error } = await db
      .from("content_imports")
      .select("id")
      .eq("subject_id", subject.id)
      .eq("checksum", manifest.checksum)
      .limit(1);
    if (error)
      throw new Error(`content_imports の確認に失敗: ${error.message}`);
    if ((data ?? []).length > 0) {
      console.log(
        "同じ checksum が投入済みのためカードはスキップ(--force で再投入)。題材情報だけ更新しました",
      );
      return 0;
    }
  }

  const existing = await fetchAll<ExistingCardRow>(
    (from, to) =>
      db
        .from("cards")
        .select("id, status, reviewed_by")
        .eq("subject_id", subject.id)
        .order("id")
        .range(from, to),
    "既存カードの取得",
  );
  const plan = planImport(existing, cards);

  const rows = plan.upsert.map(cardToRows);
  for (const part of chunk(rows, CHUNK)) {
    const r = await db.from("cards").upsert(
      part.map((x) => x.card),
      { onConflict: "id" },
    );
    if (r.error) throw new Error(`cards の upsert に失敗: ${r.error.message}`);
  }

  // 出典: upsert → 不要分だけ削除(削除→挿入の順にしない。途中失敗で出典 0 件のカードを作らないため)
  const sourceRows = rows.flatMap((x) => x.sources);
  for (const part of chunk(sourceRows, CHUNK)) {
    const r = await db
      .from("card_sources")
      .upsert(part, { onConflict: "card_id,url" });
    if (r.error)
      throw new Error(`card_sources の upsert に失敗: ${r.error.message}`);
  }
  const cardIds = plan.upsert.map((c) => c.id);
  const existingSources: { card_id: string; url: string }[] = [];
  for (const part of chunk(cardIds, CHUNK)) {
    existingSources.push(
      ...(await fetchAll<{ card_id: string; url: string }>(
        (from, to) =>
          db
            .from("card_sources")
            .select("card_id, url")
            .in("card_id", part)
            .order("card_id")
            .range(from, to),
        "既存出典の取得",
      )),
    );
  }
  let deletedSources = 0;
  for (const s of planSourceDeletes(existingSources, sourceRows)) {
    const r = await db
      .from("card_sources")
      .delete()
      .eq("card_id", s.card_id)
      .eq("url", s.url);
    if (r.error)
      throw new Error(`card_sources の削除に失敗: ${r.error.message}`);
    deletedSources += 1;
  }

  for (const part of chunk(plan.delete, CHUNK)) {
    const r = await db.from("cards").delete().in("id", part);
    if (r.error)
      throw new Error(`draft カードの削除に失敗: ${r.error.message}`);
  }
  for (const part of chunk(plan.retire, CHUNK)) {
    const r = await db
      .from("cards")
      .update({ status: "retired" })
      .in("id", part);
    if (r.error)
      throw new Error(`不要カードの retire に失敗: ${r.error.message}`);
  }

  const log = await db.from("content_imports").insert({
    subject_id: subject.id,
    version: manifest.version,
    card_count: manifest.card_count,
    checksum: manifest.checksum,
    generated_at: manifest.generated_at,
    generator: manifest.generator,
  });
  if (log.error)
    throw new Error(`content_imports の記録に失敗: ${log.error.message}`);

  console.log(
    `投入完了: cards upsert ${plan.upsert.length} / retire ${plan.retire.length} / delete ${plan.delete.length} / card_sources upsert ${sourceRows.length} / 削除 ${deletedSources}`,
  );
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
