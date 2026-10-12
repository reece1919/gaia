-- GAIA private photo storage migration (applied to GAIA Supabase on Oct 12, 2026)
-- User profile pictures stay in GitHub as public fallback; new pictures are private.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('gaia-plant-photos','gaia-plant-photos',false,8388608,array['image/jpeg'])
on conflict (id) do nothing;

create table if not exists public.plant_photos (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plant_id text not null check (length(plant_id) between 1 and 64),
  object_path text not null unique,
  caption text not null default '' check (length(caption) <= 350),
  taken_on date not null default current_date,
  created_at timestamptz not null default now(),
  constraint gaia_photo_object_owner check (split_part(object_path,'/',1)=user_id::text),
  constraint gaia_photo_object_plant check (split_part(object_path,'/',2)=plant_id),
  constraint gaia_photo_object_jpeg check (object_path like '%.jpg')
);
create index if not exists gaia_photo_user_plant_recent
  on public.plant_photos (user_id, plant_id, created_at desc);
alter table public.plant_photos enable row level security;
revoke all on public.plant_photos from anon;
grant select,insert,delete on public.plant_photos to authenticated;

create policy "gaia_photos_read_own" on public.plant_photos
  for select to authenticated using ((select auth.uid())=user_id);
create policy "gaia_photos_insert_own" on public.plant_photos
  for insert to authenticated with check ((select auth.uid())=user_id);
create policy "gaia_photos_delete_own" on public.plant_photos
  for delete to authenticated using ((select auth.uid())=user_id);

create policy "gaia_storage_read_own" on storage.objects
  for select to authenticated using (
   bucket_id='gaia-plant-photos'
   and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "gaia_storage_upload_own" on storage.objects
  for insert to authenticated with check (
   bucket_id='gaia-plant-photos'
   and (storage.foldername(name))[1] = (select auth.uid())::text
   and storage.extension(name) = 'jpg'
  );
create policy "gaia_storage_delete_own" on storage.objects
  for delete to authenticated using (
   bucket_id='gaia-plant-photos'
   and (storage.foldername(name))[1] = (select auth.uid())::text
  );
