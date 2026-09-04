/*
 * DOMPurify in src/lib/markdown.ts is the only thing standing between a hostile
 * markdown pin and a page that may be holding a decrypted private pin — see
 * attention.md. These headers are the second layer it never had.
 *
 * assets.run_worker_first is scoped to /api/* and /r/*, so this Worker is not in
 * the path for a normal page load: public/_headers carries the same policy for
 * those, and _headers in turn does not apply to anything a Worker generates.
 * Both are needed, and index.test.js fails if they drift apart.
 */
export const SECURITY_HEADERS = {
  "content-security-policy": [
    "default-src 'self'",
    // Turnstile ships its challenge as a script and an iframe from Cloudflare.
    "script-src 'self' https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    // Shiki colours every token with an inline style attribute.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = {
      "x-pinwall-client-ip": request.headers.get("cf-connecting-ip") ?? "",
      "x-pinwall-proxy-secret": env.EDGE_PROXY_SECRET,
    };
    const head = request.method === "HEAD";

    if (url.pathname === "/api/write" && request.method === "POST") {
      return fetch(`${env.SUPABASE_FUNCTIONS_URL}/create-pin-cli`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: request.body,
      });
    }

    // HEAD is answered from a GET upstream: the pin function serves GET and
    // PATCH only, and without this a HEAD fell through to the SPA and claimed
    // the raw pin was text/html.
    const api = url.pathname.match(/^\/api\/pin\/([A-Za-z0-9_-]{5,7})$/);
    if (api && (request.method === "GET" || head || request.method === "PATCH")) {
      const patch = request.method === "PATCH";
      const response = await fetch(`${env.SUPABASE_FUNCTIONS_URL}/pin/${api[1]}`, {
        method: patch ? "PATCH" : "GET",
        headers: patch ? { "content-type": "application/json" } : undefined,
        body: patch ? request.body : undefined,
      });
      return head ? new Response(null, { status: response.status, headers: response.headers }) : response;
    }

    const raw = url.pathname.match(/^\/r\/([A-Za-z0-9_-]{5,7})$/);
    if (raw && (request.method === "GET" || head)) {
      const response = await fetch(`${env.SUPABASE_FUNCTIONS_URL}/pin/${raw[1]}`);
      if (!response.ok) return new Response(null, { status: response.status });
      const pin = await response.json();
      if (pin.ciphertext) return new Response(head ? null : "encrypted pin\n", { status: 403 });
      return new Response(head ? null : pin.content, {
        headers: { "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" },
      });
    }

    // ASSETS returns immutable headers, so copy the response before adding ours.
    const asset = await env.ASSETS.fetch(request);
    const page = new Response(asset.body, asset);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) page.headers.set(name, value);
    return page;
  },
};
