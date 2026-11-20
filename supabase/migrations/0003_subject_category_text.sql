-- 題材のカテゴリを列挙から slug 形式の文字列にする(題材の追加にマイグレーションを要らなくする)
-- 既存行の値(genai / language_fw / cloud / idp / testing)はそのまま残る
alter table public.subjects
  alter column category type text using category::text,
  add constraint subjects_category_slug
    check (category ~ '^[a-z0-9]+([_-][a-z0-9]+)*$' and char_length(category) <= 40),
  add column category_label text
    check (category_label is null or char_length(category_label) between 1 and 40);

comment on column public.subjects.category_label is 'カテゴリの表示名(任意)。null なら既知の表示名か category をそのまま出す';

drop type public.subject_category;
