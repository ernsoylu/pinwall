export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = {
      "x-pinwall-client-ip": request.headers.get("cf-connecting-ip") ?? "",
      "x-pinwall-proxy-secret": env.EDGE_PROXY_SECRET,
    };

    if (url.pathname === "/api/write" && request.method === "POST") {
      return fetch(`${env.SUPABASE_FUNCTIONS_URL}/create-pin-cli`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: request.body,
      });
    }

    const api = url.pathname.match(/^\/api\/pin\/([A-Za-z0-9_-]{5,7})$/);
    if (api && (request.method === "GET" || request.method === "PATCH")) {
      return fetch(`${env.SUPABASE_FUNCTIONS_URL}/pin/${api[1]}`, {
        method: request.method,
        headers: request.method === "PATCH" ? { "content-type": "application/json" } : undefined,
        body: request.method === "PATCH" ? request.body : undefined,
      });
    }

    const raw = url.pathname.match(/^\/r\/([A-Za-z0-9_-]{5,7})$/);
    if (raw && request.method === "GET") {
      const response = await fetch(`${env.SUPABASE_FUNCTIONS_URL}/pin/${raw[1]}`);
      if (!response.ok) return new Response(null, { status: response.status });
      const pin = await response.json();
      if (pin.ciphertext) return new Response("encrypted pin\n", { status: 403 });
      return new Response(pin.content, {
        headers: { "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
