alter table public.pins
  add column expires_at timestamptz,
  add constraint pins_expiry_after_creation check (expires_at is null or expires_at > created_at);

drop policy pins_public_read on public.pins;
create policy pins_public_read on public.pins
  for select to anon, authenticated
  using (expires_at is null or expires_at > now());

grant select (expires_at) on public.pins to anon, authenticated;
