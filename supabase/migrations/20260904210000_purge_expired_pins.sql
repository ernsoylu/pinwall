-- Expiry hid pins from the RLS policy and from the pin function, but nothing
-- ever removed the row: a pin past expires_at kept its plaintext in Postgres
-- indefinitely. PRODUCT.md stakes the positioning on privacy being structural
-- rather than a policy, so "expired" has to mean deleted.

create index if not exists pins_expires_at_idx
  on public.pins (expires_at) where expires_at is not null;

create or replace function public.purge_expired_pins() returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.pins
   where expires_at is not null and expires_at <= now();
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- Only the service role sweeps, and only through the create edge functions.
revoke all on function public.purge_expired_pins() from public, anon, authenticated;
grant execute on function public.purge_expired_pins() to service_role;

-- length() counts characters while both edge functions count bytes, so a direct
-- update_pin_content call could store ~1 MB against a 256 KB ceiling. anon holds
-- EXECUTE on that RPC, so the constraint is the only check on that path.
alter table public.pins drop constraint if exists pins_size;
alter table public.pins
  add constraint pins_size
  check (octet_length(coalesce(content, ciphertext)) <= 262144);
