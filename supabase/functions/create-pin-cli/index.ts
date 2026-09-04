import { createClient } from "jsr:@supabase/supabase-js@2";
import { createPin, type Protection } from "../_shared/create.ts";

const enc = new TextEncoder();
const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

/**
 * The Worker is the only legitimate caller, and it is what sees a client IP
 * Cloudflare vouches for. This function is deployed --no-verify-jwt, so anyone
 * can reach it directly; off the proxy path there is no header here worth
 * trusting to key a rate limit, so there is no fallback. Fails closed when
 * EDGE_PROXY_SECRET is unset.
 */
export function clientIP(req: Request) {
  const secret = Deno.env.get("EDGE_PROXY_SECRET");
  const fromProxy = !!secret && req.headers.get("x-pinwall-proxy-secret") === secret;
  return fromProxy ? req.headers.get("x-pinwall-client-ip") : null;
}

export const rateLimit: Protection = async (req) => {
  const ip = clientIP(req);
  if (!ip) return { error: "proxy_required", status: 403 };
  const salt = Deno.env.get("RATE_LIMIT_SALT");
  if (!salt) return { error: "rate_limit_misconfigured", status: 500 };
  const key = hex(await crypto.subtle.digest("SHA-256", enc.encode(`${salt}:${ip}`)));
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await db.rpc("consume_pin_write_limit", {
    rate_key: key,
    max_requests: Number(Deno.env.get("CLI_WRITE_LIMIT") ?? 20),
    window_seconds: Number(Deno.env.get("CLI_WRITE_WINDOW_SECONDS") ?? 3600),
  });
  if (error) return { error: "rate_limit_failed", status: 500 };
  return data ? null : { error: "rate_limited", status: 429 };
};

if (import.meta.main) Deno.serve((req) => createPin(req, rateLimit));
