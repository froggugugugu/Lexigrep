// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { actAs, actAsAdmin, applyMigration, createMigratedDb } from "./pglite";

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CARD_PUBLISHED = "11111111-1111-4111-8111-111111111111";
const CARD_DRAFT = "22222222-2222-4222-8222-222222222222";
const CARD_HIDDEN_SUBJECT = "33333333-3333-4333-8333-333333333333";

let db: PGlite;

async function count(sql: string): Promise<number> {
  const r = await db.query<{ n: number | string }>(sql);
  return Number(r.rows[0]?.n ?? 0);
}

beforeAll(async () => {
  db = await createMigratedDb();
  await db.exec(`
    insert into auth.users (id, email) values
      ('${USER_A}', 'a@example.com'),
      ('${USER_B}', 'b@example.com');

    insert into public.subjects (id, name, category, description_ja, official_urls, version, is_published) values
      ('typescript', 'TypeScript', 'language_fw', 'TS', '{https://www.typescriptlang.org/docs/}', 1, true),
      ('hidden', 'Hidden', 'cloud', 'h', '{https://example.com/}', 1, false);

    insert into public.cards (id, subject_id, layer, target, sentence, highlight, meaning_ja, question_type, choices, frequency_rank, generated_by, reviewed_by, status) values
      ('${CARD_PUBLISHED}', 'typescript', 'pattern', 'is not assignable to',
        'Type ''string'' is not assignable to type ''number''.', int4range(14, 34),
        '〜に代入できない', 'choose_meaning', '{"options":["a","b","c","d"],"answer":0}', 1, 'human', 'owner', 'published'),
      ('${CARD_DRAFT}', 'typescript', 'vocab', 'deprecated',
        'This API is deprecated.', int4range(12, 22),
        '非推奨', 'choose_meaning', '{"options":["a","b"],"answer":1}', 2, 'human', null, 'draft'),
      ('${CARD_HIDDEN_SUBJECT}', 'hidden', 'vocab', 'bucket',
        'Create a bucket.', int4range(9, 15),
        'バケット', 'choose_meaning', '{"options":["a","b"],"answer":0}', 1, 'human', 'owner', 'published');

    insert into public.card_sources (card_id, url, title, fetched_at) values
      ('${CARD_PUBLISHED}', 'https://www.typescriptlang.org/docs/handbook/2/everyday-types.html', 'Everyday Types', now()),
      ('${CARD_DRAFT}', 'https://www.typescriptlang.org/docs/', 'Docs', now()),
      ('${CARD_HIDDEN_SUBJECT}', 'https://example.com/', 'Example', now());
  `);
});

afterAll(async () => {
  await db.close();
});

describe("マイグレーション適用", () => {
  it("すべてのテーブルが作成される", async () => {
    const r = await db.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
    );
    expect(r.rows.map((x) => x.table_name)).toEqual([
      "card_reports",
      "card_sources",
      "cards",
      "content_imports",
      "review_states",
      "session_logs",
      "subjects",
      "user_settings",
    ]);
  });

  it("全テーブルで RLS が有効", async () => {
    const r = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname",
    );
    expect(r.rows.every((x) => x.relrowsecurity)).toBe(true);
    expect(r.rows.length).toBe(8);
  });
});

describe("制約", () => {
  it("highlight が target と一致しないカードは拒否される", async () => {
    await actAsAdmin(db);
    await expect(
      db.query(
        `insert into public.cards (id, subject_id, layer, target, sentence, highlight, meaning_ja, question_type, choices, frequency_rank, generated_by, status)
         values (gen_random_uuid(), 'typescript', 'vocab', 'foo', 'bar baz', int4range(0, 3), 'x', 'choose_meaning', '{"options":["a","b"],"answer":0}', 3, 'human', 'draft')`,
      ),
    ).rejects.toThrow(/cards_highlight_matches_target/);
  });

  it("draft 以外で reviewed_by が null のカードは拒否される", async () => {
    await actAsAdmin(db);
    await expect(
      db.query(
        `insert into public.cards (id, subject_id, layer, target, sentence, highlight, meaning_ja, question_type, choices, frequency_rank, generated_by, status)
         values (gen_random_uuid(), 'typescript', 'vocab', 'foo', 'foo bar', int4range(0, 3), 'x', 'choose_meaning', '{"options":["a","b"],"answer":0}', 3, 'human', 'published')`,
      ),
    ).rejects.toThrow(/cards_reviewed_when_not_draft/);
  });

  it("related_card_ids に自分自身を含むカードは拒否される", async () => {
    await actAsAdmin(db);
    await expect(
      db.query(
        `insert into public.cards (id, subject_id, layer, target, sentence, highlight, meaning_ja, question_type, choices, frequency_rank, generated_by, status, related_card_ids)
         values ('44444444-4444-4444-8444-444444444444', 'typescript', 'vocab', 'foo', 'foo bar', int4range(0, 3), 'x', 'choose_meaning', '{"options":["a","b"],"answer":0}', 3, 'human', 'draft', '{44444444-4444-4444-8444-444444444444}')`,
      ),
    ).rejects.toThrow(/cards_related_not_self/);
  });

  it("official_urls が空の題材は拒否される", async () => {
    await actAsAdmin(db);
    await expect(
      db.query(
        `insert into public.subjects (id, name, category, description_ja, official_urls, version, is_published)
         values ('empty-urls', 'E', 'cloud', 'x', '{}', 1, false)`,
      ),
    ).rejects.toThrow(/violates check constraint/);
  });

  it("未レビューの draft を retired にすると制約違反になる(投入スクリプトは draft を削除する前提)", async () => {
    await actAsAdmin(db);
    await expect(
      db.query("update public.cards set status = 'retired' where id = $1", [
        CARD_DRAFT,
      ]),
    ).rejects.toThrow(/cards_reviewed_when_not_draft/);
    // レビュー済み(reviewed_by あり)のカードは retired にできる
    const r = await db.query(
      "update public.cards set status = 'retired' where id = $1",
      [CARD_HIDDEN_SUBJECT],
    );
    expect(r.affectedRows ?? 0).toBe(1);
    await db.query(
      "update public.cards set status = 'published' where id = $1",
      [CARD_HIDDEN_SUBJECT],
    );
  });

  it("choices の answer が範囲外なら拒否される", async () => {
    await actAsAdmin(db);
    await expect(
      db.query(
        `insert into public.cards (id, subject_id, layer, target, sentence, highlight, meaning_ja, question_type, choices, frequency_rank, generated_by, status)
         values (gen_random_uuid(), 'typescript', 'vocab', 'foo', 'foo bar', int4range(0, 3), 'x', 'choose_meaning', '{"options":["a","b"],"answer":2}', 3, 'human', 'draft')`,
      ),
    ).rejects.toThrow(/violates check constraint/);
  });
});

describe("RLS: コンテンツ", () => {
  it("匿名ユーザーは題材を読めない", async () => {
    await actAs(db, null);
    await expect(db.query("select * from public.subjects")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("認証済みユーザーは公開済み題材・公開済みカードだけ読める", async () => {
    await actAs(db, USER_A);
    expect(await count("select count(*) as n from public.subjects")).toBe(1);
    const cards = await db.query<{ id: string }>(
      "select id from public.cards order by id",
    );
    expect(cards.rows.map((c) => c.id)).toEqual([CARD_PUBLISHED]);
    expect(await count("select count(*) as n from public.card_sources")).toBe(
      1,
    );
  });

  it("認証済みユーザーはカードを書き込めない", async () => {
    await actAs(db, USER_A);
    await expect(
      db.query("update public.cards set meaning_ja = 'x' where id = $1", [
        CARD_PUBLISHED,
      ]),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("RLS: ユーザーデータ", () => {
  it("自分の SRS 状態は書けるが、他人の user_id では書けない", async () => {
    await actAs(db, USER_A);
    await db.query(
      "insert into public.review_states (user_id, card_id, due_at) values ($1, $2, now())",
      [USER_A, CARD_PUBLISHED],
    );
    await expect(
      db.query(
        "insert into public.review_states (user_id, card_id, due_at) values ($1, $2, now())",
        [USER_B, CARD_PUBLISHED],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("他人の学習ログ・SRS 状態は見えない", async () => {
    await actAs(db, USER_A);
    await db.query(
      "insert into public.session_logs (user_id, started_at, ended_at, card_results) values ($1, now(), now(), '[]')",
      [USER_A],
    );
    expect(await count("select count(*) as n from public.session_logs")).toBe(
      1,
    );
    expect(await count("select count(*) as n from public.review_states")).toBe(
      1,
    );

    await actAs(db, USER_B);
    expect(await count("select count(*) as n from public.session_logs")).toBe(
      0,
    );
    expect(await count("select count(*) as n from public.review_states")).toBe(
      0,
    );
  });

  it("他人の SRS 状態・学習ログは更新も削除もできない(0 件)", async () => {
    await actAs(db, USER_B);
    await db.query(
      "insert into public.review_states (user_id, card_id, due_at) values ($1, $2, now())",
      [USER_B, CARD_PUBLISHED],
    );
    await actAs(db, USER_A);
    const upd = await db.query(
      "update public.review_states set reps = 99 where user_id = $1",
      [USER_B],
    );
    expect(upd.affectedRows ?? 0).toBe(0);
    const del = await db.query(
      "delete from public.review_states where user_id = $1",
      [USER_B],
    );
    expect(del.affectedRows ?? 0).toBe(0);
    const delLogs = await db.query(
      "delete from public.session_logs where user_id <> $1",
      [USER_A],
    );
    expect(delLogs.affectedRows ?? 0).toBe(0);
    await actAsAdmin(db);
    expect(
      await count(
        `select count(*) as n from public.review_states where user_id = '${USER_B}' and reps = 0`,
      ),
    ).toBe(1);
    await db.query("delete from public.review_states where user_id = $1", [
      USER_B,
    ]);
  });

  it("間違い報告は本人だけが登録・閲覧できる", async () => {
    await actAs(db, USER_A);
    await db.query(
      "insert into public.card_reports (user_id, card_id, reason) values ($1, $2, '訳が不自然')",
      [USER_A, CARD_PUBLISHED],
    );
    expect(await count("select count(*) as n from public.card_reports")).toBe(
      1,
    );
    await actAs(db, USER_B);
    expect(await count("select count(*) as n from public.card_reports")).toBe(
      0,
    );
  });

  it("updated_at トリガーが更新時刻を進める", async () => {
    await actAs(db, USER_A);
    await db.query(
      "insert into public.user_settings (user_id, session_size, theme) values ($1, 12, 'system')",
      [USER_A],
    );
    const before = await db.query<{ updated_at: Date }>(
      "select updated_at from public.user_settings where user_id = $1",
      [USER_A],
    );
    await new Promise((r) => setTimeout(r, 5));
    await db.query(
      "update public.user_settings set session_size = 16 where user_id = $1",
      [USER_A],
    );
    const after = await db.query<{ updated_at: Date }>(
      "select updated_at from public.user_settings where user_id = $1",
      [USER_A],
    );
    expect(new Date(after.rows[0]!.updated_at).getTime()).toBeGreaterThan(
      new Date(before.rows[0]!.updated_at).getTime(),
    );
  });
});

describe("アカウント削除", () => {
  it("delete_my_account() で本人と関連データがすべて消える", async () => {
    await actAs(db, USER_A);
    await db.query("select public.delete_my_account()");

    await actAsAdmin(db);
    expect(
      await count(
        `select count(*) as n from auth.users where id = '${USER_A}'`,
      ),
    ).toBe(0);
    expect(
      await count(
        `select count(*) as n from public.review_states where user_id = '${USER_A}'`,
      ),
    ).toBe(0);
    expect(
      await count(
        `select count(*) as n from public.session_logs where user_id = '${USER_A}'`,
      ),
    ).toBe(0);
    expect(
      await count(
        `select count(*) as n from public.user_settings where user_id = '${USER_A}'`,
      ),
    ).toBe(0);
    expect(
      await count(
        `select count(*) as n from public.card_reports where user_id = '${USER_A}'`,
      ),
    ).toBe(0);
    // 他ユーザーには影響しない
    expect(
      await count(
        `select count(*) as n from auth.users where id = '${USER_B}'`,
      ),
    ).toBe(1);
  });

  it("未認証では delete_my_account() が失敗する", async () => {
    await actAs(db, null);
    await expect(
      db.query("select public.delete_my_account()"),
    ).rejects.toThrow();
  });
});

describe("題材のカテゴリ(0003)", () => {
  it("適用前に入っていた 5 つの値の行がそのまま残る", async () => {
    const old = await createMigratedDb({ until: "0003" });
    const values = ["genai", "language_fw", "cloud", "idp", "testing"];
    for (const v of values) {
      await old.query(
        `insert into public.subjects (id, name, category, description_ja, official_urls, version, is_published)
         values ($1, 'x', $2::public.subject_category, 'x', '{https://example.com/}', 1, true)`,
        [`s-${v.replace("_", "-")}`, v],
      );
    }
    await applyMigration(old, "0003");
    const r = await old.query<{ category: string }>(
      "select category from public.subjects order by category",
    );
    expect(r.rows.map((x) => x.category)).toEqual([...values].sort());
    await old.close();
  });

  it("任意の slug と表示名を入れられる", async () => {
    await actAsAdmin(db);
    const r = await db.query<{
      category: string;
      category_label: string | null;
    }>(
      "select category, category_label from public.subjects where id = 'typescript'",
    );
    expect(r.rows[0]).toEqual({
      category: "language_fw",
      category_label: null,
    });
    await db.query(
      `insert into public.subjects (id, name, category, category_label, description_ja, official_urls, version, is_published)
       values ('s3', 'S3', 'object-storage', 'ストレージ', 'x', '{https://example.com/}', 1, false)`,
    );
    expect(
      await count("select count(*) as n from public.subjects where id = 's3'"),
    ).toBe(1);
  });

  it("slug でないカテゴリと空の表示名は拒否される", async () => {
    await actAsAdmin(db);
    await expect(
      db.query(
        `insert into public.subjects (id, name, category, description_ja, official_urls, version, is_published)
         values ('bad-cat', 'B', 'Cloud Storage', 'x', '{https://example.com/}', 1, false)`,
      ),
    ).rejects.toThrow(/subjects_category_slug/);
    await expect(
      db.query(
        `insert into public.subjects (id, name, category, category_label, description_ja, official_urls, version, is_published)
         values ('bad-label', 'B', 'cloud', '', 'x', '{https://example.com/}', 1, false)`,
      ),
    ).rejects.toThrow(/violates check constraint/);
  });

  it("列挙型 subject_category は削除されている", async () => {
    expect(
      await count(
        "select count(*) as n from pg_type where typname = 'subject_category'",
      ),
    ).toBe(0);
  });
});
