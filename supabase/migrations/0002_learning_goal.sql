-- 学習の目的(2 軸の UX)
-- general: 題材横断の IT 英語ベース / subject: 特定の題材に集中
create type public.learning_goal as enum ('general', 'subject');

alter table public.user_settings
  add column learning_goal public.learning_goal not null default 'general',
  add column focus_subject_id text references public.subjects (id) on delete set null;
