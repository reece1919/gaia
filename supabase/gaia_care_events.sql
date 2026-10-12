-- GAIA private care journal: run in the Supabase project's SQL editor.
-- Plant descriptions/photos remain on public GitHub Pages; care events stay user-private.
create table if not exists public.plant_care_events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plant_id text not null check (length(plant_id) between 1 and 64),
  action_type text not null check (action_type in (
    'water','fertilize','repot','pest','bath','inspect','prune','note'
  )),
  happened_on date not null,
  note text not null default '' check (length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists plant_care_events_owner_date
  on public.plant_care_events(user_id, happened_on desc, created_at desc);
alter table public.plant_care_events enable row level security;
revoke all on public.plant_care_events from anon;
grant select, insert, update, delete on public.plant_care_events to authenticated;

drop policy if exists "care_select_own" on public.plant_care_events;
create policy "care_select_own" on public.plant_care_events
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "care_insert_own" on public.plant_care_events;
create policy "care_insert_own" on public.plant_care_events
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "care_update_own" on public.plant_care_events;
create policy "care_update_own" on public.plant_care_events
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "care_delete_own" on public.plant_care_events;
create policy "care_delete_own" on public.plant_care_events
  for delete to authenticated using ((select auth.uid()) = user_id);
