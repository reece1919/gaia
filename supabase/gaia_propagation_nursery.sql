-- GAIA Propagation Nursery, 2026-11-09. Authenticated, owner-only and MFA-gated.
create table public.gaia_propagation_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 100),
  parent_plant_id text check (parent_plant_id is null or length(parent_plant_id) between 1 and 64),
  method text not null default 'soil' check (method in ('water','soil','sphagnum','perlite','division','other')),
  started_on date,
  notes text not null default '' check (length(notes)<=1500),
  source_key text check (source_key is null or length(source_key)<=100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id),
  unique(user_id,source_key)
);
create index gaia_prop_batches_owner on public.gaia_propagation_batches(user_id,created_at desc);
create table public.gaia_propagation_cuttings (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null default '' check (length(nickname)<=100),
  stage text not null default 'cutting' check (stage in ('cutting','rooting','establishing','established','lost')),
  destination text not null default 'undecided' check (destination in ('undecided','keep','gift','trade','return')),
  rooted_on date,
  potted_on date,
  established_on date,
  linked_plant_id text check (linked_plant_id is null or length(linked_plant_id) between 1 and 64),
  notes text not null default '' check (length(notes)<=1500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id),
  constraint gaia_prop_cutting_owner_batch foreign key(batch_id,user_id)
    references public.gaia_propagation_batches(id,user_id) on delete cascade
);
create index gaia_prop_cuttings_owner_batch on public.gaia_propagation_cuttings(user_id,batch_id,created_at);
create table public.gaia_propagation_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cutting_id uuid not null,
  object_path text not null unique check (length(object_path)<=300),
  caption text not null default '' check (length(caption)<=350),
  taken_on date not null default current_date,
  created_at timestamptz not null default now(),
  constraint gaia_prop_photo_owner_cutting foreign key(cutting_id,user_id)
    references public.gaia_propagation_cuttings(id,user_id) on delete cascade,
  constraint gaia_prop_photo_path_owner check (split_part(object_path,'/',1)=user_id::text),
  constraint gaia_prop_photo_path_cutting check (split_part(object_path,'/',2)=cutting_id::text),
  constraint gaia_prop_photo_jpeg check (object_path like '%.jpg')
);
create index gaia_prop_photos_owner_cutting on public.gaia_propagation_photos(user_id,cutting_id,taken_on desc,created_at desc);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('gaia-propagation-photos','gaia-propagation-photos',false,8388608,array['image/jpeg'])
 on conflict(id) do nothing;
alter table public.gaia_propagation_batches enable row level security;
alter table public.gaia_propagation_cuttings enable row level security;
alter table public.gaia_propagation_photos enable row level security;
revoke all on public.gaia_propagation_batches,public.gaia_propagation_cuttings,public.gaia_propagation_photos from anon,authenticated;
grant select,insert,update,delete on public.gaia_propagation_batches,public.gaia_propagation_cuttings to authenticated;
grant select,insert,delete on public.gaia_propagation_photos to authenticated;
create policy "gaia_prop_batches_select" on public.gaia_propagation_batches for select to authenticated
 using (user_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy "gaia_prop_batches_insert" on public.gaia_propagation_batches for insert to authenticated
 with check (user_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy "gaia_prop_batches_update" on public.gaia_propagation_batches for update to authenticated
 using (user_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2')
 with check (user_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy "gaia_prop_batches_delete" on public.gaia_propagation_batches for delete to authenticated
 using (user_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy "gaia_prop_cuttings_select" on public.gaia_propagation_cuttings for select to authenticated
 using (user_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy "gaia_prop_cuttings_insert" on public.gaia_propagation_cuttings for insert to authenticated
 with check (user_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy "gaia_prop_cuttings_update" on public.gaia_propagation_cuttings for update to authenticated
 using (user_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2')
 with check (user_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy "gaia_prop_cuttings_delete" on public.gaia_propagation_cuttings for delete to authenticated
 using (user_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy "gaia_prop_photos_select" on public.gaia_propagation_photos for select to authenticated
 using (user_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy "gaia_prop_photos_insert" on public.gaia_propagation_photos for insert to authenticated
 with check (user_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy "gaia_prop_photos_delete" on public.gaia_propagation_photos for delete to authenticated
 using (user_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy "gaia_prop_storage_select" on storage.objects for select to authenticated
 using (bucket_id='gaia-propagation-photos'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and (select auth.jwt()->>'aal')='aal2');
create policy "gaia_prop_storage_insert" on storage.objects for insert to authenticated
 with check (bucket_id='gaia-propagation-photos'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and storage.extension(name)='jpg'
  and (select auth.jwt()->>'aal')='aal2');
create policy "gaia_prop_storage_delete" on storage.objects for delete to authenticated
 using (bucket_id='gaia-propagation-photos'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and (select auth.jwt()->>'aal')='aal2');
