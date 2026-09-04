import { createClient } from "jsr:@supabase/supabase-js@2";

export type Failure = { error: string; status: number; extra?: Record<string, unknown> };
export type Protection = (req: Request, body: Record<string, unknown>) => Promise<Failure | null>;
export type Insert = (row: Record<string, unknown>) => Promise<{ code?: string } | null>;

const MAX = 262144;
const ID = /^[A-Za-z0-9_-]{5,7}$/;
const LANG = /^[a-z0-9+#.-]{1,32}$/;

const corsFor = (req: Request) => ({
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": req.headers.get("access-control-request-headers") ??
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin, Access-Control-Request-Headers",
});

export async function createPin(req: Request, protect: Protection, insert?: Insert) {
  const cors = corsFor(req);
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const { id, language, content, ciphertext, iv, expires_at } = body;
  // typeof before the regex: String(["abc1234"]) passes it, and the array is
  // what would then reach the insert.
  if (typeof id !== "string" || !ID.test(id)) return json({ error: "bad_id" }, 400);
  if (typeof language !== "string" || !LANG.test(language)) return json({ error: "bad_language" }, 400);
  if (expires_at != null && (typeof expires_at !== "string" ||
    !Number.isFinite(Date.parse(expires_at)) || Date.parse(expires_at) <= Date.now())) {
    return json({ error: "bad_expiry" }, 400);
  }

  const isPrivate = ciphertext != null;
  const payload = isPrivate ? ciphertext : content;
  if (typeof payload !== "string" || payload.length === 0) return json({ error: "empty" }, 400);
  if (new TextEncoder().encode(payload).length > MAX) return json({ error: "too_large" }, 413);
  if (isPrivate && typeof iv !== "string") return json({ error: "missing_iv" }, 400);

  const failure = await protect(req, body);
  if (failure) return json({ error: failure.error, ...failure.extra }, failure.status);

  const edit_token = crypto.randomUUID();
  const row = {
    id, language, edit_token, expires_at: expires_at ?? null,
    content: isPrivate ? null : content,
    ciphertext: isPrivate ? ciphertext : null,
    iv: isPrivate ? iv : null,
  };
  let error: { code?: string } | null;
  if (insert) {
    error = await insert(row);
  } else {
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    error = (await db.from("pins").insert(row)).error;
    // Expiry hid pins from every read but never removed the row. Sweep on the
    // write path, the way consume_pin_write_limit already sweeps its own table.
    // Best effort: a failed sweep must not fail someone's create.
    if (!error) await db.rpc("purge_expired_pins").then(() => {}, () => {});
  }
  if (error?.code === "23505") return json({ error: "id_taken" }, 409);
  if (error) return json({ error: "insert_failed" }, 500);
  return json({ id, edit_token }, 201);
}
