-- Automatic photo touch-up: when a card's photos went through the touch-up review (or were saved from
-- the photo editor). Null means not checked yet, so the batch pass on the More page picks the card up.
alter table public.cards
  add column photos_checked_at timestamptz;
