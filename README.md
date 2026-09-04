# pinwall

Fast, anonymous, zero-knowledge text and code sharing. Live at **https://pw.pee.pw**.

## How the privacy works

- **Private pins** are encrypted in the browser with PBKDF2 (310k iterations, SHA-256) + AES-GCM.
  The passphrase never leaves the device; the database only ever receives `ciphertext` and `iv`.
- **Edit tokens** live in the URL fragment (`/abc1234#token`), which browsers never send to a
  server. `anon` has no `SELECT` grant on the `edit_token` column, so a token cannot be read back
  out of a pin.
- **Writes** never go direct. Creates run through the `create-pin` edge function behind Cloudflare
  Turnstile; edits run through the `update_pin_content` RPC, which validates the token itself.
  `INSERT`/`UPDATE`/`DELETE` are revoked from `anon` entirely.

## Commands

```bash
npm run dev         # dev server
npm run test        # vitest
npm run typecheck   # tsc
npm run lint        # oxlint
npm run build       # typecheck + bundle + SPA 404 fallback
```

## Configuration

`.env.local` (all three are public, client-side values):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_TURNSTILE_SITE_KEY=
```

The Turnstile **secret** key is set as a Supabase edge function secret (`TURNSTILE_SECRET_KEY`),
never in this repo.

## Backend

`supabase/migrations` holds the schema and the `update_pin_content` RPC.
`supabase/functions/create-pin` is the Turnstile-gated insert.
