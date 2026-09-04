# pinwall

Fast, anonymous, zero-knowledge text and code sharing. Live at **https://pw.pee.pw**.

## Architecture

```text
Browser ── page/assets ──┐
                        ├── Cloudflare Worker (pw.pee.pw)
pw CLI ── /api, /r ─────┘          │
                                    ▼
                         Supabase Edge Functions
                                    │
                                    ▼
                         PostgreSQL (pins + limits)
```

- **Cloudflare Worker** serves the built web app, exposes raw public pins at `/r/TAG`, and proxies
  CLI requests without exposing the shared edge secret. The existing `pw.pee.pw` DNS record is
  retained and the Worker runs on the `pw.pee.pw/*` route.
- **Supabase Edge Functions** are the only write boundary. `create-pin` verifies Turnstile for the
  browser, `create-pin-cli` applies an IP-based rate limit for POSIX clients, and `pin` handles CLI
  reads and token-authorized amendments. All three deploy `--no-verify-jwt`, so `create-pin-cli`
  accepts the Worker only: it keys its limit on the IP the Worker vouches for with
  `EDGE_PROXY_SECRET`, and refuses anything arriving without it rather than trusting a header the
  caller supplied.
- **PostgreSQL** stores pins, expiry metadata, edit-token hashes, and rate-limit counters. Database
  grants and RPCs prevent anonymous clients from inserting, changing, deleting, or recovering edit
  tokens directly.
- **Clients own encryption.** The browser and `pw` encrypt and decrypt private pins locally. The
  passphrase is never sent to Cloudflare, Supabase, or PostgreSQL.
- **GitHub Actions** runs the browser, Worker, Edge Function, installer, and Go checks. Merges to
  `main` deploy Supabase and the Worker; version tags build signed-by-checksum release archives used
  by the installer at `/r/pwsh001`.

## CLI

```sh
curl -fsSL --proto '=https' --proto-redir '=https' https://pw.pee.pw/r/pwsh001 | sh
```

```sh
printf 'hello\n' | pw write
cat deploy.sh | pw write --language shell --edit-url
pw TAG
pw TAG --pass XXXXXXXXXXXXXXXX
pw TAG | sh
printf 'replacement\n' | pw amend 'TAG#EDIT_TOKEN'
pw update
```

`pw` keeps diagnostics on stderr, so stdout can be piped safely. `--pass` encrypts writes and
decrypts reads locally using the browser-compatible format. Command arguments may be visible in
shell history and process listings.

### Installer mirror

`https://pw.pee.pw/r/pwsh001` is itself a pin, so `curl … | sh` serves whatever that pin holds.
The release workflow keeps it in step with `install.sh`, and checks before publishing rather than
after: a release it cannot mirror is refused outright, because shipping the previous version's
installer alongside new binaries is worse than not releasing.

Bootstrapping happens once, on a tag nobody has claimed:

```sh
go run ./cmd/pw write --tag pwsh001 --edit-url < install.sh
```

Save the printed edit URL as the `PINWALL_INSTALL_EDIT_URL` repository secret. **There is no second
chance.** The tag returns `id_taken` once it exists, and the edit token cannot be read back out of
the row — `anon` has no `SELECT` grant on `edit_token`, which is the same property that makes the
privacy claim hold. If the URL is lost, the mirror can only move to a fresh tag, which changes the
documented install command; serving `install.sh` as a static asset from `public/` is the way out
that keeps a stable URL without a token to lose.

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

## Turnstile keys: dev vs production

Cloudflare production keys reject `localhost` and flag automation tools, so
`npm run dev` must not use them.

| | Sitekey (frontend) | Secret (backend) |
|---|---|---|
| dev | `1x00000000000000000000AA` (always passes) | `1x0000000000000000000000000000000AA` |
| prod | real, from the Cloudflare dashboard | real, as a Supabase function secret |

The dev sitekey lives in `.env.development`, which Vite loads for `vite dev`
only and which overrides `.env.local`. `npm run build` never sees it, and CI
supplies the real values as repository variables. So the split is automatic —
there is nothing to remember to switch.

**The one gotcha:** the dummy sitekey emits `XXXX.DUMMY.TOKEN.XXXX`, and a
*production* secret rejects that token. Against the deployed function, local
creates therefore return `turnstile_failed` by design — the widget renders and
the request reaches the backend, but verification fails on the last hop.

To exercise a full create locally, run the whole stack locally so the function
uses a dev secret:

```bash
supabase start                              # db + functions on :54321
echo 'TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA' > supabase/functions/.env
supabase functions serve create-pin --env-file supabase/functions/.env
```

then point `.env.development` at `VITE_SUPABASE_URL=http://localhost:54321`
(supabase-js derives the functions URL from it; there is no separate override).

Do **not** instead set the test secret on the deployed project. A test secret
accepts `XXXX.DUMMY.TOKEN.XXXX` from anyone, which removes bot protection from
production entirely.

## Backend

`supabase/migrations` holds the schema and the `update_pin_content` RPC.
`supabase/functions/create-pin` is the Turnstile-gated browser insert;
`create-pin-cli` is the rate-limited CLI insert, and `pin` serves CLI reads and amendments.

Production deployment also needs repository variables `SUPABASE_PROJECT_REF` and
`SUPABASE_FUNCTIONS_URL`, plus secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`,
`EDGE_PROXY_SECRET`, `RATE_LIMIT_SALT`, `CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_ACCOUNT_ID`.
