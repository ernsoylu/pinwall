import { createClient } from "@supabase/supabase-js";
import { customAlphabet } from "nanoid";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(url, key);

// Must satisfy the pins_id_format DB constraint: ^[A-Za-z0-9_-]{5,7}$
export const newId = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  7,
);

// anon has no SELECT grant on edit_token, so `select *` is rejected.
const COLUMNS = "id, content, ciphertext, iv, language, created_at";

export type Pin = {
  id: string;
  content: string | null;
  ciphertext: string | null;
  iv: string | null;
  language: string;
  created_at: string;
};

export class ApiError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "ApiError";
    this.code = code;
  }
}

export async function getPin(id: string): Promise<Pin | null> {
  const { data, error } = await supabase.from("pins").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new ApiError(error.message);
  return data;
}

type NewPin = {
  language: string;
  turnstileToken: string;
} & ({ content: string } | { ciphertext: string; iv: string });

/** Creates a pin, retrying on nanoid collisions. Returns the id and edit token. */
export async function createPin(pin: NewPin, attempts = 3): Promise<{ id: string; edit_token: string }> {
  const { turnstileToken, ...rest } = pin;

  for (let i = 0; i < attempts; i++) {
    const { data, error } = await supabase.functions.invoke("create-pin", {
      body: { ...rest, id: newId(), token: turnstileToken },
    });

    if (!error) return data;

    const code = await errorCode(error);
    if (code !== "id_taken") throw new ApiError(code);
  }
  throw new ApiError("id_taken");
}

export async function updatePin(
  id: string,
  editToken: string,
  payload: { content: string } | { ciphertext: string; iv: string },
): Promise<boolean> {
  const isPrivate = "ciphertext" in payload;
  const { data, error } = await supabase.rpc("update_pin_content", {
    pin_id: id,
    new_content: isPrivate ? null : payload.content,
    provided_token: editToken,
    new_ciphertext: isPrivate ? payload.ciphertext : null,
    new_iv: isPrivate ? payload.iv : null,
  });
  if (error) throw new ApiError(error.message);
  return data === true;
}

/** functions.invoke hides the response body inside a FunctionsHttpError. */
async function errorCode(error: unknown): Promise<string> {
  const res = (error as { context?: Response }).context;
  if (!res || typeof res.json !== "function") return (error as Error).message ?? "unknown";
  try {
    const body = await res.json();
    return body?.error ?? `http_${res.status}`;
  } catch {
    return `http_${res.status}`;
  }
}
