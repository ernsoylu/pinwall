import assert from "node:assert/strict";
import test from "node:test";
import worker from "./index.js";

test("/r/TAG returns exact public content", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ content: "#!/bin/sh\necho ok\n", ciphertext: null });
  try {
    const response = await worker.fetch(new Request("https://pw.pee.pw/r/abc1234"), {});
    assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(await response.text(), "#!/bin/sh\necho ok\n");
  } finally { globalThis.fetch = original; }
});

test("/r/TAG refuses encrypted pins", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ ciphertext: "sealed" });
  try {
    const response = await worker.fetch(new Request("https://pw.pee.pw/r/abc1234"), {});
    assert.equal(response.status, 403);
  } finally { globalThis.fetch = original; }
});

test("write proxy authenticates the client IP", async () => {
  const original = globalThis.fetch;
  let upstream;
  globalThis.fetch = async (url, init) => { upstream = { url, init }; return Response.json({ id: "abc1234" }, { status: 201 }); };
  try {
    const request = new Request("https://pw.pee.pw/api/write", {
      method: "POST", headers: { "cf-connecting-ip": "203.0.113.9" }, body: "{}",
    });
    const response = await worker.fetch(request, { SUPABASE_FUNCTIONS_URL: "https://functions.test", EDGE_PROXY_SECRET: "secret" });
    assert.equal(response.status, 201);
    assert.equal(upstream.url, "https://functions.test/create-pin-cli");
    assert.equal(upstream.init.headers["x-pinwall-client-ip"], "203.0.113.9");
    assert.equal(upstream.init.headers["x-pinwall-proxy-secret"], "secret");
  } finally { globalThis.fetch = original; }
});

test("pin API proxies GET and PATCH, other paths use assets", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => { calls.push([url, init.method]); return Response.json({ id: "abc1234" }); };
  const assets = { fetch: async () => new Response("site") };
  try {
    await worker.fetch(new Request("https://pw.pee.pw/api/pin/abc1234"), { SUPABASE_FUNCTIONS_URL: "https://functions.test" });
    await worker.fetch(new Request("https://pw.pee.pw/api/pin/abc1234", { method: "PATCH", body: "{}" }), { SUPABASE_FUNCTIONS_URL: "https://functions.test" });
    const fallback = await worker.fetch(new Request("https://pw.pee.pw/abc1234"), { ASSETS: assets });
    assert.deepEqual(calls, [["https://functions.test/pin/abc1234", "GET"], ["https://functions.test/pin/abc1234", "PATCH"]]);
    assert.equal(await fallback.text(), "site");
  } finally { globalThis.fetch = original; }
});

test("HEAD on a raw pin keeps the pin's content type instead of falling through", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push(init.method ?? "GET");
    return Response.json({ content: "#!/bin/sh\n", ciphertext: null });
  };
  const assets = { fetch: async () => new Response("<!doctype html>", { headers: { "content-type": "text/html" } }) };
  try {
    const raw = await worker.fetch(new Request("https://pw.pee.pw/r/abc1234", { method: "HEAD" }), { SUPABASE_FUNCTIONS_URL: "https://functions.test", ASSETS: assets });
    assert.equal(raw.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(await raw.text(), "");
    const api = await worker.fetch(new Request("https://pw.pee.pw/api/pin/abc1234", { method: "HEAD" }), { SUPABASE_FUNCTIONS_URL: "https://functions.test", ASSETS: assets });
    assert.equal(api.status, 200);
    // Upstream is asked for a GET both times: the pin function serves no HEAD.
    assert.deepEqual(calls, ["GET", "GET"]);
  } finally { globalThis.fetch = original; }
});

test("the app is served with a CSP that keeps Turnstile working", async () => {
  const assets = { fetch: async () => new Response("site", { headers: { "content-type": "text/html" } }) };
  const response = await worker.fetch(new Request("https://pw.pee.pw/abc1234"), { ASSETS: assets });
  const csp = response.headers.get("content-security-policy");
  assert.match(csp, /script-src 'self' https:\/\/challenges\.cloudflare\.com/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(await response.text(), "site");
});

test("raw endpoint preserves upstream failure status", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 404 });
  try {
    assert.equal((await worker.fetch(new Request("https://pw.pee.pw/r/abc1234"), {})).status, 404);
  } finally { globalThis.fetch = original; }
});
