-- Each set's parallels ("rainbow"): which colors and finishes exist, and what each is numbered to.
-- Per year + set + insert, because base cards and autographs usually have different rainbows.
-- In 2011 Bowman Chrome Draft, a card numbered /5 can only be the Red Refractor, so a print run read
-- from the card (or typed) settles a parallel the photo can't, such as red against pink.
-- Filled from saved cards (trigger below), from AI fetches of a set's parallel list (scan-cards
-- function, 'search'), and by hand on the Sets page ('manual').

create function public.set_parallel_key(year text, set_name text, insert_name text, parallel text)
returns text
language sql
immutable
set search_path = ''
as $$
  select public.checklist_norm(year) || '|' || public.checklist_norm(set_name) || '|' ||
         public.checklist_norm(insert_name) || '|' || public.checklist_norm(parallel)
$$;

create table public.set_parallels (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  year         text not null,
  set_name     text not null,
  insert_name  text not null default '',
  parallel     text not null check (btrim(parallel) <> ''),
  -- null: not serial numbered. Several parallels can share one (the 1/1s: Superfractor, printing plates).
  print_run    int check (print_run > 0),
  -- 'collection': from a card I saved. 'search': from an AI search of the set's parallel list.
  -- 'manual': typed or imported on the Sets page; never overwritten automatically.
  source       text not null check (source in ('collection', 'search', 'manual')),
  source_url   text,
  parallel_key text generated always as (public.set_parallel_key(year, set_name, insert_name, parallel)) stored,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index set_parallels_key_idx on public.set_parallels (user_id, parallel_key);

create trigger set_parallels_set_updated_at
  before update on public.set_parallels
  for each row execute function public.set_updated_at();

alter table public.set_parallels enable row level security;

create policy "Users can read their own parallels"
  on public.set_parallels for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own parallels"
  on public.set_parallels for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own parallels"
  on public.set_parallels for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own parallels"
  on public.set_parallels for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Learn parallels from saved cards. A card's print run beats an AI search's; a card without one never
-- erases a known one; entries added by hand are left alone. Deleting a card keeps the entry (the parallel
-- still exists), and a mistaken one is removed on the Sets page.
create function public.sync_parallels_from_card()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if btrim(coalesce(new.parallel, '')) = '' then
    return new;
  end if;
  insert into public.set_parallels (user_id, year, set_name, insert_name, parallel, print_run, source)
  values (new.user_id, new.year, new.set_name, coalesce(new.insert_name, ''), new.parallel, new.print_run, 'collection')
  on conflict (user_id, parallel_key) do update set
    print_run = coalesce(excluded.print_run, public.set_parallels.print_run),
    source = 'collection',
    source_url = case when excluded.print_run is null then public.set_parallels.source_url end
  where public.set_parallels.source <> 'manual';
  return new;
exception when others then
  -- A convenience: a problem here must never stop a card from saving.
  raise warning 'set parallels not updated: %', sqlerrm;
  return new;
end
$$;

create trigger cards_sync_parallels
  after insert or update of year, set_name, insert_name, parallel, print_run
  on public.cards
  for each row execute function public.sync_parallels_from_card();

-- Start from the cards already saved (the numbered copy wins when a parallel appears more than once).
insert into public.set_parallels (user_id, year, set_name, insert_name, parallel, print_run, source)
select distinct on (user_id, public.set_parallel_key(year, set_name, insert_name, parallel))
  user_id, year, set_name, coalesce(insert_name, ''), parallel, print_run, 'collection'
from public.cards
where btrim(coalesce(parallel, '')) <> ''
order by user_id, public.set_parallel_key(year, set_name, insert_name, parallel), print_run nulls last, updated_at desc
on conflict (user_id, parallel_key) do nothing;

-- AI fetches of a set's parallel list: one row per set, so the Sets page can show what's being fetched
-- and what came back, and a set isn't fetched twice. Batched fetches are collected by the function's poll.
create table public.parallel_fetches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  year        text not null,
  set_name    text not null,
  status      text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  batch_id    text,
  -- How many parallels it found, the model's note, or why it failed.
  found       int,
  notes       text,
  error       text,
  set_key     text generated always as (public.checklist_norm(year) || '|' || public.checklist_norm(set_name)) stored,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index parallel_fetches_set_idx on public.parallel_fetches (user_id, set_key);

create trigger parallel_fetches_set_updated_at
  before update on public.parallel_fetches
  for each row execute function public.set_updated_at();

alter table public.parallel_fetches enable row level security;

create policy "Users can read their own parallel fetches"
  on public.parallel_fetches for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own parallel fetches"
  on public.parallel_fetches for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own parallel fetches"
  on public.parallel_fetches for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own parallel fetches"
  on public.parallel_fetches for delete to authenticated
  using ((select auth.uid()) = user_id);

-- The spending log gets a kind for fetching a set's parallel list.
alter table public.ai_usage drop constraint ai_usage_kind_check;
alter table public.ai_usage add constraint ai_usage_kind_check
  check (kind in ('read', 'lookup', 'identify', 'parallels'));
