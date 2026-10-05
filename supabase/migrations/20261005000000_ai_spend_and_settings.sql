-- AI spending log and per-user app settings.
-- Anthropic has no API for a prepaid credit balance (and the cost Admin API isn't open to individual
-- accounts), so the app logs what each AI call actually cost and subtracts it from a balance the
-- collector enters from the Console.

create table public.ai_usage (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  kind          text not null check (kind in ('read', 'lookup', 'identify')),
  model         text not null,
  cards         int not null default 1,
  searches      int not null default 0,
  input_tokens  int,
  output_tokens int,
  dollars       numeric(10, 4) not null
);

create index ai_usage_user_id_created_at_idx on public.ai_usage (user_id, created_at);

alter table public.ai_usage enable row level security;

create policy "Users can read their own AI usage"
  on public.ai_usage for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can log their own AI usage"
  on public.ai_usage for insert to authenticated
  with check ((select auth.uid()) = user_id);

create table public.app_settings (
  user_id          uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- Ask before every AI run (with a cost estimate). Off = runs start right away; estimates still show.
  confirm_ai_runs  boolean not null default true,
  -- Send cards the AI is unsure about for a checklist web search automatically after reading.
  auto_lookup      boolean not null default true,
  -- Credit balance as shown in the Anthropic Console, and when it was entered.
  credit_dollars   numeric(10, 2),
  credit_set_at    timestamptz,
  updated_at       timestamptz not null default now()
);

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;

create policy "Users can read their own settings"
  on public.app_settings for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own settings"
  on public.app_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own settings"
  on public.app_settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
