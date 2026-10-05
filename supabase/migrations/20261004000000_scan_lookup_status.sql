-- Scans can now be "looking_up": the AI's first reading had a doubt that the set's checklist can
-- settle, so the card went out once more with web search. The result lands in extraction.lookup.
alter table public.card_scans drop constraint card_scans_status_check;
alter table public.card_scans add constraint card_scans_status_check
  check (status in ('pending', 'processing', 'looking_up', 'ready', 'failed'));
