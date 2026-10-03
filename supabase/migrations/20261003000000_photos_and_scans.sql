-- Phase 2: card photos and the scan inbox.
-- Photos live in the private `card-photos` bucket under `{user_id}/...`.
-- A thumbnail sits next to each photo with a `-thumb` suffix (see src/lib/photos.ts).

alter table public.cards
  add column front_image_path text,
  add column back_image_path  text;

-- Scan inbox: one row per card cut out of a capture photo, waiting for review.
-- `extraction` holds the AI's draft fields; confirming a scan creates a card and
-- deletes the scan row (the photos move over to the card).
create table public.card_scans (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,

  front_image_path text not null,
  back_image_path  text,

  status           text not null default 'pending'
                   check (status in ('pending', 'processing', 'ready', 'failed')),
  extraction       jsonb,
  error            text,
  batch_id         text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index card_scans_user_id_idx on public.card_scans (user_id);

create trigger card_scans_set_updated_at
  before update on public.card_scans
  for each row execute function public.set_updated_at();

alter table public.card_scans enable row level security;

create policy "Users can read their own scans"
  on public.card_scans for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own scans"
  on public.card_scans for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own scans"
  on public.card_scans for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own scans"
  on public.card_scans for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Private photo bucket. Each user may only touch objects under their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-photos', 'card-photos', false, 10485760, array['image/webp', 'image/jpeg']);

create policy "Users can read their own photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'card-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can upload their own photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'card-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can update their own photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'card-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'card-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete their own photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'card-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
