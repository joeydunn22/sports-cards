-- Patch and Relic become one flag: any memorabilia piece (jersey, patch, bat, ball) is a relic.
-- Patch cards keep their flag as relics before the column goes.
update public.cards set is_relic = true where is_patch and not is_relic;

alter table public.cards drop column is_patch;

comment on column public.cards.is_relic is 'Memorabilia of any kind: jersey swatch, patch, bat, ball.';
