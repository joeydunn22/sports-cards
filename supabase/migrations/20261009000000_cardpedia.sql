-- Baseball Cardpedia: a free baseball card wiki whose set pages list every parallel with its print run
-- and the full checklist. The scan-cards function fetches a baseball set's page once (no AI, no cost)
-- and stores what it finds in set_parallels and checklist_entries as source 'cardpedia'.

alter table public.checklist_entries drop constraint checklist_entries_source_check;
alter table public.checklist_entries add constraint checklist_entries_source_check
  check (source in ('collection', 'search', 'cardpedia'));

alter table public.set_parallels drop constraint set_parallels_source_check;
alter table public.set_parallels add constraint set_parallels_source_check
  check (source in ('collection', 'search', 'manual', 'cardpedia'));

-- A full checklist is hundreds or thousands of spots per set, too many to load whole (Supabase also caps
-- a response at 1,000 rows), so the app and the function load one set at a time, or one player's spots.
create function public.set_key(year text, set_name text)
returns text
language sql
immutable
set search_path = ''
as $$ select public.checklist_norm(year) || '|' || public.checklist_norm(set_name) $$;

alter table public.checklist_entries
  add column set_key text generated always as (public.set_key(year, set_name)) stored,
  add column player_key text generated always as (public.checklist_norm(player)) stored;
create index checklist_entries_set_idx on public.checklist_entries (user_id, set_key);
create index checklist_entries_player_idx on public.checklist_entries (user_id, player_key);

alter table public.set_parallels
  add column set_key text generated always as (public.set_key(year, set_name)) stored;
create index set_parallels_set_idx on public.set_parallels (user_id, set_key);

-- One row per set the function looked for on Baseball Cardpedia: which page it used (or that none
-- matched), and what it brought back. The Sets page shows it and can point a set at another page.
create table public.cardpedia_imports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  year        text not null,
  set_name    text not null,
  -- 'done': page found and read. 'not_found': no page matches the name. 'failed': couldn't reach or read it.
  status      text not null check (status in ('done', 'not_found', 'failed')),
  page        text,
  parallels   int not null default 0,
  cards       int not null default 0,
  error       text,
  set_key     text generated always as (public.set_key(year, set_name)) stored,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index cardpedia_imports_set_idx on public.cardpedia_imports (user_id, set_key);

create trigger cardpedia_imports_set_updated_at
  before update on public.cardpedia_imports
  for each row execute function public.set_updated_at();

alter table public.cardpedia_imports enable row level security;

create policy "Users can read their own Cardpedia imports"
  on public.cardpedia_imports for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own Cardpedia imports"
  on public.cardpedia_imports for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own Cardpedia imports"
  on public.cardpedia_imports for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own Cardpedia imports"
  on public.cardpedia_imports for delete to authenticated
  using ((select auth.uid()) = user_id);

-- The Sets page's list: every set the database knows, with counts, without loading every row.
-- security_invoker, so row-level security on the tables underneath applies to whoever asks.
create view public.known_sets with (security_invoker = true) as
select
  set_key,
  min(year) as year,
  min(set_name) as set_name,
  count(*) filter (where kind = 'parallel')::int as parallels,
  count(*) filter (where kind = 'card')::int as cards,
  coalesce(bool_or(has_list), false) as has_list
from (
  select set_key, year, set_name, 'parallel' as kind, source <> 'collection' as has_list from public.set_parallels
  union all
  select set_key, year, set_name, 'card', false from public.checklist_entries
) known
group by set_key;
