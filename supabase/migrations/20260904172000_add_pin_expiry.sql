alter table public.pins
  add column if not exists expires_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.pins'::regclass
      and conname = 'pins_expiry_after_creation'
  ) then
    alter table public.pins
      add constraint pins_expiry_after_creation
      check (expires_at is null or expires_at > created_at);
  end if;
end
$$;

drop policy pins_public_read on public.pins;
create policy pins_public_read on public.pins
  for select to anon, authenticated
  using (expires_at is null or expires_at > now());

grant select (expires_at) on public.pins to anon, authenticated;
