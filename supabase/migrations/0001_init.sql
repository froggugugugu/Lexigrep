-- =============================================================================
-- Lexigrep 初期スキーマ
--
-- 原則: アプリは特定題材を知らない。題材・層・カードはすべてデータ。
-- 定義源: src/shared/content/schema.ts(Zod)。本 SQL はそれと 1:1 に対応させる。
-- RLS: コンテンツは「公開済み」のみ閲覧可、ユーザーデータは本人のみ読み書き可。
--      書込(コンテンツ投入)は service_role(RLS をバイパス)でのみ行う。
-- =============================================================================

-- ── 列挙型 ───────────────────────────────────────────────────────────────────
create type public.subject_category as enum ('genai', 'language_fw', 'cloud', 'idp', 'testing');
create type public.card_layer as enum ('vocab', 'pattern', 'idiom', 'system_term');
create type public.question_type as enum ('choose_meaning', 'fill_blank', 'recognize_pattern', 'next_action');
create type public.card_status as enum ('draft', 'reviewed', 'published', 'retired');
create type public.review_state as enum ('new', 'learning', 'review', 'relearning');
create type public.theme as enum ('system', 'dark', 'light');

-- ── 共通トリガー: updated_at ─────────────────────────────────────────────────
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── 題材 ─────────────────────────────────────────────────────────────────────
create table public.subjects (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  category public.subject_category not null,
  description_ja text not null check (char_length(description_ja) between 1 and 200),
  official_urls text[] not null default '{}' check (cardinality(official_urls) >= 1),
  license_note text not null default '' check (char_length(license_note) <= 1000),
  version integer not null default 1 check (version >= 1),
  crawled_at timestamptz,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.subjects is '題材(TypeScript, Next.js, ...)。common は題材横断の共通語彙';

create trigger subjects_set_updated_at
  before update on public.subjects
  for each row execute function public.set_updated_at();

-- ── カード ───────────────────────────────────────────────────────────────────
create table public.cards (
  id uuid primary key,
  subject_id text not null references public.subjects (id) on delete cascade,
  layer public.card_layer not null,
  target text not null check (char_length(target) between 1 and 120),
  sentence text not null check (char_length(sentence) between 1 and 400),
  -- sentence 内の target の位置 [start, end)
  highlight int4range not null check (lower(highlight) >= 0 and not isempty(highlight)),
  meaning_ja text not null check (char_length(meaning_ja) between 1 and 200),
  note_ja text check (note_ja is null or char_length(note_ja) <= 600),
  question_type public.question_type not null,
  prompt_ja text check (prompt_ja is null or char_length(prompt_ja) <= 200),
  -- {"options": string[], "answer": number}
  choices jsonb not null check (
    jsonb_typeof(choices -> 'options') = 'array'
    and jsonb_typeof(choices -> 'answer') = 'number'
    and jsonb_array_length(choices -> 'options') between 2 and 6
    and (choices ->> 'answer')::int between 0 and jsonb_array_length(choices -> 'options') - 1
  ),
  frequency_rank integer not null check (frequency_rank >= 1),
  related_card_ids uuid[] not null default '{}',
  generated_by text not null check (char_length(generated_by) between 1 and 80),
  reviewed_by text check (reviewed_by is null or char_length(reviewed_by) between 1 and 80),
  status public.card_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cards_reviewed_when_not_draft check (status = 'draft' or reviewed_by is not null),
  constraint cards_related_not_self check (not (id = any (related_card_ids))),
  constraint cards_highlight_matches_target check (
    substring(sentence from lower(highlight) + 1 for upper(highlight) - lower(highlight)) = target
  )
);
comment on table public.cards is '学習カード。1 カード = 1 パターン。実文(sentence)と出典(card_sources)を必ず持つ';

create index cards_subject_layer_rank_idx
  on public.cards (subject_id, layer, frequency_rank)
  where status = 'published';
create index cards_status_idx on public.cards (status);

create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

-- ── 出典 ─────────────────────────────────────────────────────────────────────
create table public.card_sources (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  url text not null check (url ~ '^https?://'),
  title text not null check (char_length(title) between 1 and 300),
  fetched_at timestamptz not null,
  attribution text check (attribution is null or char_length(attribution) <= 500),
  unique (card_id, url)
);
comment on table public.card_sources is 'カードの出典(公式ドキュメントの URL)。取得日は陳腐化検知に使う';

create index card_sources_card_idx on public.card_sources (card_id);

-- ── 投入履歴(manifest) ──────────────────────────────────────────────────────
create table public.content_imports (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references public.subjects (id) on delete cascade,
  version integer not null check (version >= 1),
  card_count integer not null check (card_count >= 0),
  checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
  generated_at timestamptz not null,
  generator text not null,
  imported_at timestamptz not null default now()
);
comment on table public.content_imports is 'scripts/import-subject.ts の投入履歴。同じ checksum の再投入はスキップに使う';

create index content_imports_subject_idx on public.content_imports (subject_id, imported_at desc);

-- ── ユーザー設定 ─────────────────────────────────────────────────────────────
create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  session_size integer not null default 12 check (session_size between 8 and 20),
  theme public.theme not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ── SRS 状態(ユーザー × カード、FSRS) ──────────────────────────────────────
create table public.review_states (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  stability double precision not null default 0 check (stability >= 0),
  stability_fast double precision not null default 0 check (stability_fast >= 0),
  difficulty double precision not null default 0 check (difficulty >= 0),
  due_at timestamptz not null,
  last_reviewed_at timestamptz,
  reps integer not null default 0 check (reps >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  state public.review_state not null default 'new',
  scheduled_days double precision not null default 0 check (scheduled_days >= 0),
  learning_step integer not null default 0 check (learning_step >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, card_id)
);
comment on table public.review_states is 'FSRS のカード状態。stability_fast / scheduled_days / learning_step は ts-fsrs 6(FSRS-7)の内部値';

create index review_states_due_idx on public.review_states (user_id, due_at);

create trigger review_states_set_updated_at
  before update on public.review_states
  for each row execute function public.set_updated_at();

-- ── 学習ログ ─────────────────────────────────────────────────────────────────
create table public.session_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null check (ended_at >= started_at),
  subject_id text references public.subjects (id) on delete set null,
  layer public.card_layer,
  -- [{"card_id": uuid, "correct": bool, "elapsed_ms": int}]
  card_results jsonb not null default '[]'::jsonb check (jsonb_typeof(card_results) = 'array'),
  created_at timestamptz not null default now()
);

create index session_logs_user_started_idx on public.session_logs (user_id, started_at desc);

-- ── 間違い報告 ───────────────────────────────────────────────────────────────
create table public.card_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index card_reports_card_idx on public.card_reports (card_id);

-- ── アカウント削除(全データ消去) ────────────────────────────────────────────
-- auth.users からの削除で public.* は on delete cascade により消える。
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ── 権限 ─────────────────────────────────────────────────────────────────────
-- 匿名(anon)には一切見せない。認証済みユーザーには必要な操作だけを与え直す(既定権限に頼らない)。
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
grant select on public.subjects, public.cards, public.card_sources to authenticated;
grant select, insert, update, delete on public.user_settings, public.review_states, public.session_logs to authenticated;
grant select, insert on public.card_reports to authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.subjects enable row level security;
alter table public.cards enable row level security;
alter table public.card_sources enable row level security;
alter table public.content_imports enable row level security;
alter table public.user_settings enable row level security;
alter table public.review_states enable row level security;
alter table public.session_logs enable row level security;
alter table public.card_reports enable row level security;

-- コンテンツ: 公開済みのみ閲覧可(書込ポリシーなし = service_role のみ)
create policy subjects_select_published on public.subjects
  for select to authenticated
  using (is_published);

create policy cards_select_published on public.cards
  for select to authenticated
  using (
    status = 'published'
    and exists (select 1 from public.subjects s where s.id = cards.subject_id and s.is_published)
  );

create policy card_sources_select_published on public.card_sources
  for select to authenticated
  using (
    exists (
      select 1
      from public.cards c
      join public.subjects s on s.id = c.subject_id
      where c.id = card_sources.card_id and c.status = 'published' and s.is_published
    )
  );

-- content_imports: 閲覧ポリシーなし(service_role のみ)

-- ユーザーデータ: 本人のみ
create policy user_settings_own on public.user_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy review_states_own on public.review_states
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy session_logs_own on public.session_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy card_reports_insert_own on public.card_reports
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy card_reports_select_own on public.card_reports
  for select to authenticated
  using (user_id = (select auth.uid()));

-- 関数の権限は上の一括 revoke の後に付け直す
grant execute on function public.delete_my_account() to authenticated;
grant execute on function auth.uid() to authenticated, anon;
