import { createClient } from "jsr:@supabase/supabase-js@2";

// supabase-js sends x-client-info and x-supabase-api-version alongside the auth
// headers. Reflecting the requested list avoids the browser rejecting a preflight
// over a header we forgot to name, which fails before the POST is ever sent.
const corsFor = (req: Request) => ({
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    req.headers.get("access-control-request-headers") ??
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin, Access-Control-Request-Headers",
});

const jsonWith = (cors: Record<string, string>) => (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });

const MAX = 262144;
const ID = /^[A-Za-z0-9_-]{5,7}$/;
const LANG = /^[a-z0-9+#.-]{1,32}$/;

Deno.serve(async (req) => {
  const cors = corsFor(req);
  const json = jsonWith(cors);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const { token, id, language, content, ciphertext, iv } = body as Record<string, string>;

  if (!token) return json({ error: "missing_turnstile_token" }, 400);
  if (!ID.test(id ?? "")) return json({ error: "bad_id" }, 400);
  if (!LANG.test(language ?? "")) return json({ error: "bad_language" }, 400);

  const isPrivate = ciphertext != null;
  const payload = isPrivate ? ciphertext : content;
  if (typeof payload !== "string" || payload.length === 0) return json({ error: "empty" }, 400);
  if (payload.length > MAX) return json({ error: "too_large" }, 413);
  if (isPrivate && typeof iv !== "string") return json({ error: "missing_iv" }, 400);
  if (!isPrivate && content == null) return json({ error: "empty" }, 400);

  const verify = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        secret: Deno.env.get("TURNSTILE_SECRET_KEY"),
        response: token,
        remoteip: req.headers.get("cf-connecting-ip") ?? undefined,
      }),
    },
  );
  const outcome = await verify.json();
  if (!outcome.success) return json({ error: "turnstile_failed" }, 403);

  const edit_token = crypto.randomUUID();
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await db.from("pins").insert({
    id,
    language,
    edit_token,
    content: isPrivate ? null : content,
    ciphertext: isPrivate ? ciphertext : null,
    iv: isPrivate ? iv : null,
  });

  // 23505 = unique_violation. The client picks a new nanoid and retries.
  if (error?.code === "23505") return json({ error: "id_taken" }, 409);
  if (error) return json({ error: "insert_failed" }, 500);

  return json({ id, edit_token }, 201);
});
