-- One private, account-scoped plant-display order; plant details stay in plants.json.
create table if not exists public.gaia_plant_order (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plant_ids text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint gaia_plant_order_max_items check (cardinality(plant_ids) <= 500)
);
alter table public.gaia_plant_order enable row level security;

create policy gaia_plant_order_select_own
on public.gaia_plant_order for select to authenticated
using ((select auth.uid()) = user_id);

create policy gaia_plant_order_insert_own
on public.gaia_plant_order for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy gaia_plant_order_update_own
on public.gaia_plant_order for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy require_verified_totp_aal2
on public.gaia_plant_order as restrictive for all to authenticated
using (((select auth.jwt()) ->> 'aal') = 'aal2')
with check (((select auth.jwt()) ->> 'aal') = 'aal2');

revoke all on public.gaia_plant_order from anon;
grant select, insert, update on public.gaia_plant_order to authenticated;
