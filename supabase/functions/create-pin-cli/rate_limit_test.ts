import { clientIP, rateLimit } from "./index.ts";

const assert = (value: unknown) => { if (!value) throw new Error("assertion failed"); };

Deno.test("client IP uses trusted proxy value only with matching secret", () => {
  Deno.env.set("EDGE_PROXY_SECRET", "right");
  const trusted = new Request("https://x", { headers: {
    "x-pinwall-proxy-secret": "right", "x-pinwall-client-ip": "203.0.113.8", "x-forwarded-for": "fake, 198.51.100.2",
  }});
  assert(clientIP(trusted) === "203.0.113.8");
  const direct = new Request("https://x", { headers: {
    "x-pinwall-proxy-secret": "wrong", "x-pinwall-client-ip": "fake", "x-forwarded-for": "fake, 198.51.100.2",
  }});
  assert(clientIP(direct) === "198.51.100.2");
});

Deno.test("rate limiter fails closed when unconfigured", async () => {
  const salt = Deno.env.get("RATE_LIMIT_SALT");
  Deno.env.delete("RATE_LIMIT_SALT");
  try {
    const result = await rateLimit(new Request("https://x", { headers: { "cf-connecting-ip": "203.0.113.8" } }), {});
    assert(result?.status === 500);
  } finally { if (salt) Deno.env.set("RATE_LIMIT_SALT", salt); }
});
