create table public.pin_write_limits (
  key text primary key,
  window_started_at timestamptz not null,
  requests integer not null check (requests > 0)
);

revoke all on public.pin_write_limits from public, anon, authenticated;

create function public.consume_pin_write_limit(
  rate_key text,
  max_requests integer,
  window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed boolean;
begin
  if rate_key is null or max_requests < 1 or window_seconds < 1 then
    return false;
  end if;

  -- ponytail: cleanup during writes; use a scheduled batch only if this table becomes large.
  delete from public.pin_write_limits
   where window_started_at < now() - make_interval(secs => window_seconds * 2);

  insert into public.pin_write_limits as limits (key, window_started_at, requests)
  values (rate_key, now(), 1)
  on conflict (key) do update
     set window_started_at = case
           when limits.window_started_at <= now() - make_interval(secs => window_seconds) then now()
           else limits.window_started_at
         end,
         requests = case
           when limits.window_started_at <= now() - make_interval(secs => window_seconds) then 1
           else limits.requests + 1
         end
   where limits.window_started_at <= now() - make_interval(secs => window_seconds)
      or limits.requests < max_requests
  returning true into allowed;

  return coalesce(allowed, false);
end;
$$;

revoke all on function public.consume_pin_write_limit(text, integer, integer) from public;
