import { createClient } from "jsr:@supabase/supabase-js@2";

const ID = /^[A-Za-z0-9_-]{5,7}$/;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });

type Result<T> = Promise<{ data: T; error: unknown }>;
export type PinDB = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Result<Record<string, string | null | undefined> | null>;
      };
    };
  };
  rpc: (name: string, args: Record<string, unknown>) => Result<boolean | null>;
};

export async function handlePin(req: Request, supplied?: PinDB) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const id = new URL(req.url).pathname.split("/").filter(Boolean).at(-1) ?? "";
  if (!ID.test(id)) return json({ error: "bad_id" }, 400);

  const db = supplied ?? createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  ) as unknown as PinDB;
  if (req.method === "GET") {
    const { data, error } = await db.from("pins")
      .select("id,content,ciphertext,iv,language,created_at,expires_at")
      .eq("id", id).maybeSingle();
    if (error) return json({ error: "read_failed" }, 500);
    if (!data || (data.expires_at && Date.parse(data.expires_at) <= Date.now())) {
      return json({ error: "not_found" }, 404);
    }
    return json(data);
  }

  if (req.method === "PATCH") {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
    const encrypted = typeof body.ciphertext === "string";
    const payload = encrypted ? body.ciphertext : body.content;
    if (typeof payload !== "string" || payload.length === 0) return json({ error: "empty" }, 400);
    if (new TextEncoder().encode(payload).length > 262144) return json({ error: "too_large" }, 413);
    if (encrypted && typeof body.iv !== "string") return json({ error: "missing_iv" }, 400);
    const { data, error } = await db.rpc("update_pin_content", {
      pin_id: id,
      provided_token: body.edit_token,
      new_content: encrypted ? null : body.content,
      new_ciphertext: encrypted ? body.ciphertext : null,
      new_iv: encrypted ? body.iv : null,
    });
    if (error) return json({ error: "update_failed" }, 500);
    return data ? json({ id }) : json({ error: "invalid_edit_token" }, 403);
  }

  return json({ error: "method_not_allowed" }, 405);
}

if (import.meta.main) Deno.serve((req) => handlePin(req));
