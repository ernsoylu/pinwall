create table public.pins (
  id text primary key,
  content text,
  ciphertext text,
  iv text,
  language text not null default 'text',
  edit_token uuid,
  created_at timestamptz not null default now(),
  constraint pins_id_format check (id ~ '^[A-Za-z0-9_-]{5,7}$'),
  constraint pins_payload check (
    (content is not null and ciphertext is null and iv is null)
    or (content is null and ciphertext is not null and iv is not null)
  ),
  constraint pins_size check (length(coalesce(content, ciphertext)) <= 262144)
);

alter table public.pins enable row level security;

create policy pins_public_read on public.pins
  for select to anon, authenticated using (true);

-- anon gets SELECT only, and never on edit_token: leaking it would let anyone
-- edit any pin. INSERT goes through the create-pin edge function (service role).
revoke all on public.pins from anon, authenticated;
grant select (id, content, ciphertext, iv, language, created_at)
  on public.pins to anon, authenticated;

-- Updates are token-gated here, not by RLS.
create function public.update_pin_content(
  pin_id text,
  new_content text,
  provided_token text,
  new_ciphertext text default null,
  new_iv text default null
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.pins
     set content    = new_content,
         ciphertext = new_ciphertext,
         iv         = new_iv
   where id = pin_id
     and edit_token is not null
     and provided_token is not null
     and edit_token::text = provided_token;
  return found;
end;
$$;

revoke all on function public.update_pin_content(text, text, text, text, text) from public;
grant execute on function public.update_pin_content(text, text, text, text, text)
  to anon, authenticated;
