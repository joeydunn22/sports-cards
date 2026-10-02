-- Cards: one row per distinct card in the collection.
-- Identity rules (set vs insert vs parallel) are documented in CLAUDE.md.

create table public.cards (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,

  -- Identity (required)
  player          text not null check (btrim(player) <> ''),
  year            text not null check (btrim(year) <> ''),
  set_name        text not null check (btrim(set_name) <> ''),
  card_number     text not null check (btrim(card_number) <> ''),
  sport           text not null check (btrim(sport) <> ''),

  -- Identity (optional)
  insert_name     text,
  parallel        text,
  team            text,

  -- Flags
  is_rookie       boolean not null default false,
  is_auto         boolean not null default false,
  is_patch        boolean not null default false,
  is_relic        boolean not null default false,

  -- Serial numbering: 23/99 -> serial_number 23, print_run 99
  serial_number   integer check (serial_number > 0),
  print_run       integer check (print_run > 0),
  constraint serial_within_print_run
    check (serial_number is null or print_run is null or serial_number <= print_run),

  quantity        integer not null default 1 check (quantity >= 1),

  -- Grading
  is_graded       boolean not null default false,
  grade_company   text,
  grade           text,
  cert_number     text,
  raw_condition   text,

  -- Money (all optional)
  purchase_price  numeric(10, 2) check (purchase_price >= 0),
  purchase_date   date,
  estimated_value numeric(10, 2) check (estimated_value >= 0),
  sold_price      numeric(10, 2) check (sold_price >= 0),
  sold_date       date,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index cards_user_id_idx on public.cards (user_id);

-- Keep updated_at current on every update.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

-- Row-level security: each user sees and edits only their own cards.
alter table public.cards enable row level security;

create policy "Users can read their own cards"
  on public.cards for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own cards"
  on public.cards for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own cards"
  on public.cards for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own cards"
  on public.cards for delete to authenticated
  using ((select auth.uid()) = user_id);
