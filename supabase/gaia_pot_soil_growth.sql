-- Applied to GAIA Supabase as gaia_pot_soil_growth_logs (2026-10-23).
-- Public GitHub includes only the schema; actual plant logs stay owner-private.
create table if not exists public.gaia_pot_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  plant_id text not null check (length(plant_id) between 1 and 64),
  inner_diameter_in numeric(5,2) check (inner_diameter_in > 0 and inner_diameter_in <= 100),
  inner_depth_in numeric(5,2) check (inner_depth_in > 0 and inner_depth_in <= 100),
  inner_material text not null default '' check (length(inner_material) <= 80),
  clear_inner boolean not null default false,
  drainage_holes boolean not null default false,
  outer_pot text not null default '' check (length(outer_pot) <= 120),
  soil_mix text not null default '' check (length(soil_mix) <= 500),
  repotted_on date,
  updated_at timestamptz not null default now(),
  primary key(user_id, plant_id)
);
create table if not exists public.gaia_soil_observations (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plant_id text not null check (length(plant_id) between 1 and 64),
  observed_on date not null,
  moisture_value numeric(6,2) check (moisture_value between 0 and 100),
  moisture_scale text not null default '1-10' check (moisture_scale in ('1-10','0-100','other')),
  new_growth boolean not null default false,
  note text not null default '' check (length(note) <= 500),
  created_at timestamptz not null default now(),
  check (moisture_value is not null or new_growth or length(trim(note)) > 0)
);
create index if not exists gaia_soil_obs_owner_plant_date
  on public.gaia_soil_observations(user_id,plant_id,observed_on desc,created_at desc);
alter table public.gaia_pot_profiles enable row level security;
alter table public.gaia_soil_observations enable row level security;
revoke all on public.gaia_pot_profiles from anon;
revoke all on public.gaia_soil_observations from anon;
grant select,insert,update,delete on public.gaia_pot_profiles to authenticated;
grant select,insert,update,delete on public.gaia_soil_observations to authenticated;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gaia_pot_profiles' and policyname='gaia_pots_select') then
    create policy gaia_pots_select on public.gaia_pot_profiles for select to authenticated using ((select auth.uid()) = user_id);
    create policy gaia_pots_insert on public.gaia_pot_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
    create policy gaia_pots_update on public.gaia_pot_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
    create policy gaia_pots_delete on public.gaia_pot_profiles for delete to authenticated using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gaia_soil_observations' and policyname='gaia_soil_select') then
    create policy gaia_soil_select on public.gaia_soil_observations for select to authenticated using ((select auth.uid()) = user_id);
    create policy gaia_soil_insert on public.gaia_soil_observations for insert to authenticated with check ((select auth.uid()) = user_id);
    create policy gaia_soil_update on public.gaia_soil_observations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
    create policy gaia_soil_delete on public.gaia_soil_observations for delete to authenticated using ((select auth.uid()) = user_id);
  end if;
end $$;