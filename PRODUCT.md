# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers, sharing code. The reach-for moment is a snippet, stack trace, config
fragment, or log that needs to travel — to a teammate, into a ticket or chat
thread, or between the person's own machines — right now, with no account and no
setup. The language picker and Shiki highlighting exist for this user; markdown
pins serve the same person writing notes, runbooks, or a README fragment rather
than code.

Anyone can use pinwall without being this user, and the encrypted path serves a
broader "hand over sensitive text" case, but developer code-sharing is the
audience design decisions are settled against.

## Product Purpose

Take arbitrary text or code and turn it into a shareable short link in one
screen, with no identity attached and — when the visitor asks for it — no
server-readable copy of the content.

Success is a pin created and its link handed off before a signup form would have
finished loading. Deployed at https://pw.pee.pw.

## Positioning

The privacy is structural, not a policy. A private pin is encrypted in the
browser with PBKDF2 (310k iterations, SHA-256) + AES-GCM; the passphrase never
leaves the device and the database receives only `ciphertext` and `iv`. Edit
authority lives in the URL fragment, which browsers never transmit, and the
`anon` role holds no `SELECT` grant on `edit_token` — so the token cannot be
read back out of the row it authorizes.

A competitor can promise not to read your pastes. pinwall's claim is that it
cannot, and the claim is checkable in the schema and the client bundle rather
than in a privacy policy.

## Operating Context

- Reached mid-task, usually from an editor, terminal, or chat window, with text
  already on the clipboard. Time-to-link is the metric that matters.
- Links are consumed in chat threads, issue trackers, and code review, where
  they sit next to other links and must read as trustworthy at a glance.
- QR handoff exists for moving a pin from a workstation to a phone.
- Two routes only: `/` creates, `/<id>` views. The edit link is `/<id>#<token>`;
  a rendered markdown link is `/<id>?view=rendered`.
- Static SPA on GitHub Pages, backed by Supabase (Postgres + one edge function).
  Writes never go direct: creates run through the Turnstile-gated `create-pin`
  edge function, edits through the `update_pin_content` RPC, and
  `INSERT`/`UPDATE`/`DELETE` are revoked from `anon` entirely.

## Capabilities and Constraints

Built and confirmed:

- Public pins (plaintext stored) and private pins (client-side encrypted).
- 19 highlighted languages via Shiki; `text` is the fallback for anything else.
- Markdown pins render, sanitised through DOMPurify before any HTML is injected.
- Editing via the fragment token, for both public and private pins.
- Copy, raw view, and QR code on share.
- Optional expiry: `expires_at` hides a pin from every read path, and
  `purge_expired_pins()` deletes it — swept on each create, the way the CLI rate
  limiter sweeps its own table. "Kept until" means deleted, not merely hidden.
- Bot protection via Cloudflare Turnstile in `interaction-only` mode.
- Hard limits: pin content ≤ 256 KB (DB constraint); ids are 5–7 characters
  matching `^[A-Za-z0-9_-]{5,7}$`.

Constraints future work must respect:

- **Rendered markdown must stay sanitised.** Pin text is untrusted and a
  rendered page can hold decrypted private text in memory at the same time;
  dropping the sanitiser is an XSS that reads a private pin. See `attention.md`.
- **The editor must never trap the keyboard.** Tab indents, and Escape must
  release the next Tab. See `attention.md`.
- **Never call `turnstile.reset()`** — an `interaction-only` widget reset that
  way stays hidden and strands the visitor on a dead submit button. See
  `attention.md`.
- The Turnstile secret is a Supabase function secret and never enters this repo;
  a test secret must never be set on the deployed project.
- **The app's security headers are load-bearing, not decoration.** The CSP in
  `worker/index.js` is the second layer behind DOMPurify. See `attention.md`.

Not decided: whether the edit token should also authorize deletion.

## Brand Commitments

- Name: **pinwall**, lowercase, set in mono. Domain `pw.pee.pw`.
- MIT licensed and open — the privacy claims are meant to be read in the source.
- The four commitments below are binding and cannot be traded away by any later
  feature:
  1. **Zero-knowledge private pins.** No feature may require the server to read
     private content.
  2. **No accounts, ever.** No sign-up, no login, no identity. Anonymity is
     structural, not a setting.
  3. **No tracking, no ads.** No analytics, no third-party beacons, no
     monetization surface beyond what running it requires.
  4. **Instant, one-screen creation.** Paste and create in a single view — no
     wizard, no upsell, no interstitial.

## Evidence on Hand

- The live deployment at https://pw.pee.pw and the whole source tree, which is
  the proof for every privacy claim above.
- `README.md` (privacy mechanics, dev/prod Turnstile key split) and
  `attention.md` (the four load-bearing invariants).
- `supabase/migrations/20260904063325_pins.sql` — grants, RLS, and the
  token-gated update RPC; the checkable form of the positioning claim.
- Screenshots: `creator-write.png`, `turnstile-state.png`. `design.pen` exists
  in the repo root.

No testimonials, user counts, traffic figures, benchmarks, press, uptime
guarantees, or third-party audits exist. None may be written into any surface.

## Product Principles

1. **The privacy must be verifiable, not asserted.** Claims on any surface state
   the mechanism (in-browser encryption, no `SELECT` on the token, revoked
   writes) so a skeptical developer can check them against the source.
2. **Time-to-link is the product.** Anything added to the creation path has to
   pay for the milliseconds and the attention it costs.
3. **Anonymity is structural.** No feature may reintroduce identity, accounts,
   or per-visitor tracking as the price of a capability.
4. **The pin is the interface.** Content — code, markdown, ciphertext — is the
   subject; chrome earns its place by serving handoff, trust, or editing.
5. **Say what the state actually is.** Encryption status, verification failures,
   token permanence, and the 256 KB ceiling are told plainly rather than
   softened, because a wrong guess here loses someone's text.

## Accessibility & Inclusion

No formal conformance standard has been set. One product-specific requirement is
already binding: the code editor must remain escapable by keyboard, because Tab
is intercepted for indentation and a keyboard-only visitor would otherwise be
trapped in the textarea (`attention.md`, covered by
`src/components/CodeEditor.test.tsx`).
