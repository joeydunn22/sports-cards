-- Self-building checklist cache: what's known about each checklist spot (year + set + insert + card #).
-- Filled automatically from saved cards (trigger below) and from AI checklist searches that settled a
-- card (written by the scan-cards function). The function checks it before paying for a web search.

-- Same normalization as the app (src/features/cards/duplicates.ts, supabase/functions/scan-cards/cache.ts):
-- case, spaces and punctuation don't matter, so "Topps Chrome" / "topps chrome" and "RC-12" / "RC12" match.
create function public.checklist_norm(value text)
returns text
language sql
immutable
set search_path = ''
as $$ select lower(regexp_replace(coalesce(value, ''), '[^a-zA-Z0-9]', '', 'g')) $$;

create function public.checklist_spot_key(year text, set_name text, insert_name text, card_number text)
returns text
language sql
immutable
set search_path = ''
as $$
  select public.checklist_norm(year) || '|' || public.checklist_norm(set_name) || '|' ||
         public.checklist_norm(insert_name) || '|' || public.checklist_norm(card_number)
$$;

create table public.checklist_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  year        text not null,
  set_name    text not null,
  insert_name text not null default '',
  card_number text not null,
  player      text not null,
  team        text,
  sport       text,
  is_rookie   boolean not null default false,
  -- 'collection': from a card I saved (trusted). 'search': from an AI checklist search.
  source      text not null check (source in ('collection', 'search')),
  source_url  text,
  spot_key    text generated always as (public.checklist_spot_key(year, set_name, insert_name, card_number)) stored,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index checklist_entries_spot_idx on public.checklist_entries (user_id, spot_key);

create trigger checklist_entries_set_updated_at
  before update on public.checklist_entries
  for each row execute function public.set_updated_at();

alter table public.checklist_entries enable row level security;

create policy "Users can read their own checklist"
  on public.checklist_entries for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add to their own checklist"
  on public.checklist_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own checklist"
  on public.checklist_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete from their own checklist"
  on public.checklist_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Keep the cache in step with saved cards. A saved card is the best source, so it overwrites a search
-- entry. When a card's spot changes (a corrected card number, say) or the card is deleted, the old spot
-- is dropped if no other card still has it, so a typo doesn't linger as "known".
create function public.sync_checklist_from_card()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  old_key text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_key := public.checklist_spot_key(old.year, old.set_name, old.insert_name, old.card_number);
    if tg_op = 'DELETE'
       or old_key <> public.checklist_spot_key(new.year, new.set_name, new.insert_name, new.card_number) then
      delete from public.checklist_entries e
      where e.user_id = old.user_id
        and e.spot_key = old_key
        and e.source = 'collection'
        and not exists (
          select 1 from public.cards c
          where c.user_id = old.user_id
            and c.id <> old.id
            and public.checklist_spot_key(c.year, c.set_name, c.insert_name, c.card_number) = old_key
        );
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  insert into public.checklist_entries
    (user_id, year, set_name, insert_name, card_number, player, team, sport, is_rookie, source)
  values
    (new.user_id, new.year, new.set_name, coalesce(new.insert_name, ''), new.card_number,
     new.player, new.team, new.sport, new.is_rookie, 'collection')
  on conflict (user_id, spot_key) do update set
    year = excluded.year,
    set_name = excluded.set_name,
    insert_name = excluded.insert_name,
    card_number = excluded.card_number,
    player = excluded.player,
    team = coalesce(excluded.team, public.checklist_entries.team),
    sport = excluded.sport,
    is_rookie = excluded.is_rookie,
    source = 'collection',
    source_url = null;
  return new;
exception when others then
  -- The cache is a convenience: a problem here must never stop a card from saving.
  raise warning 'checklist cache not updated: %', sqlerrm;
  return coalesce(new, old);
end
$$;

create trigger cards_sync_checklist
  after insert or delete or update of year, set_name, insert_name, card_number, player, team, sport, is_rookie
  on public.cards
  for each row execute function public.sync_checklist_from_card();

-- Start from the cards already saved.
insert into public.checklist_entries
  (user_id, year, set_name, insert_name, card_number, player, team, sport, is_rookie, source)
select distinct on (user_id, public.checklist_spot_key(year, set_name, insert_name, card_number))
  user_id, year, set_name, coalesce(insert_name, ''), card_number, player, team, sport, is_rookie, 'collection'
from public.cards
order by user_id, public.checklist_spot_key(year, set_name, insert_name, card_number), updated_at desc
on conflict (user_id, spot_key) do nothing;
