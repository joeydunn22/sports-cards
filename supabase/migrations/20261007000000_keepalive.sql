-- Keep-alive heartbeat. Free projects pause after about 7 days without activity, and an anonymous read of
-- `cards` (which RLS answers with nothing) turned out not to count: the project paused in October 2026
-- despite pings every 3 days. The keep-alive workflow now calls rpc/keepalive, a real database write.

create table public.keepalive (
  id        int primary key check (id = 1),
  pinged_at timestamptz not null default now()
);

-- RLS on with no policies: nobody reads or writes the table directly, only through the function below.
alter table public.keepalive enable row level security;

-- Callable with the publishable key. The worst anyone can do with it is move one timestamp.
create function public.keepalive()
returns timestamptz
language sql
security definer
set search_path = ''
as $$
  insert into public.keepalive (id, pinged_at) values (1, now())
  on conflict (id) do update set pinged_at = excluded.pinged_at
  returning pinged_at
$$;

revoke execute on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
