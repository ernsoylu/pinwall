import { turnstile } from "./index.ts";

const assert = (value: unknown) => { if (!value) throw new Error("assertion failed"); };

Deno.test("Turnstile requires a token", async () => {
  assert((await turnstile(new Request("https://x"), {}))?.error === "missing_turnstile_token");
});
Deno.test("Turnstile distinguishes rejection from bad secret", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = (() => Promise.resolve(Response.json({ success: false, "error-codes": ["invalid-input-response"] }))) as typeof fetch;
    assert((await turnstile(new Request("https://x"), { token: "x" }))?.status === 403);
    globalThis.fetch = (() => Promise.resolve(Response.json({ success: false, "error-codes": ["invalid-input-secret"] }))) as typeof fetch;
    assert((await turnstile(new Request("https://x"), { token: "x" }))?.status === 500);
    globalThis.fetch = (() => Promise.resolve(Response.json({ success: true }))) as typeof fetch;
    assert(await turnstile(new Request("https://x"), { token: "x" }) === null);
  } finally { globalThis.fetch = original; }
});
