-- GAIA top-of-dashboard follow-up checklist.
-- Migration applied to the GAIA Supabase project on Oct 12, 2026.
-- Completion is per signed-in user; ticking a task does not log watering/treatment.
create table if not exists public.gaia_task_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id text not null check (length(task_id) between 1 and 100),
  completed_at timestamptz not null default now(),
  primary key (user_id, task_id)
);
alter table public.gaia_task_completions enable row level security;
revoke all on public.gaia_task_completions from anon;
grant select, insert, update, delete on public.gaia_task_completions to authenticated;

create policy "gaia_tasks_select_own" on public.gaia_task_completions
 for select to authenticated using ((select auth.uid()) = user_id);
create policy "gaia_tasks_insert_own" on public.gaia_task_completions
 for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "gaia_tasks_update_own" on public.gaia_task_completions
 for update to authenticated using ((select auth.uid()) = user_id)
 with check ((select auth.uid()) = user_id);
create policy "gaia_tasks_delete_own" on public.gaia_task_completions
 for delete to authenticated using ((select auth.uid()) = user_id);
