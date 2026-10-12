-- GAIA Midnight Herbarium: user-created garden tasks, separate from static care notes.
-- Applied to the GAIA Supabase project. Sign-in required for all task mutations.
create table if not exists public.gaia_custom_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plant_id text null check (plant_id is null or length(plant_id) between 1 and 64),
  title text not null check (length(btrim(title)) between 1 and 120),
  detail text not null default '' check (length(detail) <= 500),
  due_on date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gaia_custom_tasks_user_status_due
  on public.gaia_custom_tasks (user_id,completed_at,due_on,created_at);
alter table public.gaia_custom_tasks enable row level security;
revoke all on public.gaia_custom_tasks from anon;
grant select,insert,update,delete on public.gaia_custom_tasks to authenticated;
create policy "gaia_custom_tasks_select_own" on public.gaia_custom_tasks
  for select to authenticated using ((select auth.uid())=user_id);
create policy "gaia_custom_tasks_insert_own" on public.gaia_custom_tasks
  for insert to authenticated with check ((select auth.uid())=user_id);
create policy "gaia_custom_tasks_update_own" on public.gaia_custom_tasks
  for update to authenticated using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
create policy "gaia_custom_tasks_delete_own" on public.gaia_custom_tasks
  for delete to authenticated using ((select auth.uid())=user_id);
