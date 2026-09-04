import { createPin, type Protection } from "../_shared/create.ts";

export const turnstile: Protection = async (req, body) => {
  if (!body.token) return { error: "missing_turnstile_token", status: 400 };
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      secret: Deno.env.get("TURNSTILE_SECRET_KEY"),
      response: body.token,
      remoteip: req.headers.get("cf-connecting-ip") ?? undefined,
    }),
  });
  const outcome = await response.json();
  if (outcome.success) return null;
  const codes: string[] = outcome["error-codes"] ?? [];
  const ours = codes.some((code) => code.includes("secret"));
  return {
    error: ours ? "turnstile_misconfigured" : "turnstile_failed",
    status: ours ? 500 : 403,
    extra: { codes },
  };
};

if (import.meta.main) Deno.serve((req) => createPin(req, turnstile));
