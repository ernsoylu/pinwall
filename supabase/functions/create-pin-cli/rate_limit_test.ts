import { clientIP, rateLimit } from "./index.ts";

const assert = (value: unknown) => { if (!value) throw new Error("assertion failed"); };

Deno.test("client IP comes from the proxy or nowhere", () => {
  Deno.env.set("EDGE_PROXY_SECRET", "right");
  const trusted = new Request("https://x", { headers: {
    "x-pinwall-proxy-secret": "right", "x-pinwall-client-ip": "203.0.113.8", "x-forwarded-for": "fake, 198.51.100.2",
  }});
  assert(clientIP(trusted) === "203.0.113.8");
  // Deployed --no-verify-jwt, so a direct caller could otherwise pick its own
  // rate-limit bucket by naming its own IP.
  const direct = new Request("https://x", { headers: {
    "x-pinwall-proxy-secret": "wrong", "cf-connecting-ip": "fake", "x-forwarded-for": "fake, 198.51.100.2",
  }});
  assert(clientIP(direct) === null);
});

Deno.test("an unset proxy secret fails closed rather than trusting everyone", () => {
  const secret = Deno.env.get("EDGE_PROXY_SECRET");
  Deno.env.delete("EDGE_PROXY_SECRET");
  try {
    const request = new Request("https://x", { headers: { "x-pinwall-proxy-secret": "", "x-pinwall-client-ip": "203.0.113.8" } });
    assert(clientIP(request) === null);
  } finally { if (secret) Deno.env.set("EDGE_PROXY_SECRET", secret); }
});

Deno.test("rate limiter refuses direct calls and unconfigured salt", async () => {
  Deno.env.set("EDGE_PROXY_SECRET", "right");
  const direct = await rateLimit(new Request("https://x", { headers: { "cf-connecting-ip": "203.0.113.8" } }), {});
  assert(direct?.status === 403 && direct?.error === "proxy_required");

  const salt = Deno.env.get("RATE_LIMIT_SALT");
  Deno.env.delete("RATE_LIMIT_SALT");
  try {
    const proxied = new Request("https://x", { headers: {
      "x-pinwall-proxy-secret": "right", "x-pinwall-client-ip": "203.0.113.8",
    }});
    const result = await rateLimit(proxied, {});
    assert(result?.status === 500);
  } finally { if (salt) Deno.env.set("RATE_LIMIT_SALT", salt); }
});
