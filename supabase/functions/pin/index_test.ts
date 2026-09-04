import { handlePin, type PinDB } from "./index.ts";

const assert = (value: unknown, message = "assertion failed") => { if (!value) throw new Error(message); };
function fakeClient(pin: Record<string, string | null | undefined> | null, rpcResult: boolean | Error = true): PinDB {
  return {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: pin, error: null }) }) }) }),
    rpc: async () => rpcResult instanceof Error
      ? { data: null, error: rpcResult }
      : { data: rpcResult, error: null },
  } as unknown as PinDB;
}

Deno.test("pin GET returns public and encrypted records", async () => {
  for (const pin of [{ id: "abc1234", content: "hello" }, { id: "abc1234", ciphertext: "sealed", iv: "iv" }]) {
    const response = await handlePin(new Request("https://x/pin/abc1234"), fakeClient(pin));
    assert(response.status === 200);
    assert((await response.json()).id === "abc1234");
  }
});

Deno.test("pin GET hides missing and expired records", async () => {
  const missing = await handlePin(new Request("https://x/pin/abc1234"), fakeClient(null));
  const expired = await handlePin(new Request("https://x/pin/abc1234"), fakeClient({
    id: "abc1234", content: "old", expires_at: "2000-01-01T00:00:00Z",
  }));
  assert(missing.status === 404 && expired.status === 404);
});

Deno.test("pin PATCH validates payload and edit token", async () => {
  const patch = (body: unknown, client = fakeClient(null)) => handlePin(new Request("https://x/pin/abc1234", {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }), client);
  assert((await patch({ content: "" })).status === 400);
  assert((await patch({ ciphertext: "sealed" })).status === 400);
  assert((await patch({ content: "x".repeat(262145) })).status === 413);
  assert((await patch({ content: "ok", edit_token: "wrong" }, fakeClient(null, false))).status === 403);
  assert((await patch({ content: "ok", edit_token: "right" }, fakeClient(null, true))).status === 200);
});

Deno.test("pin rejects invalid tags, methods, and malformed JSON", async () => {
  assert((await handlePin(new Request("https://x/pin/bad"))).status === 400);
  assert((await handlePin(new Request("https://x/pin/abc1234", { method: "DELETE" }), fakeClient(null))).status === 405);
  assert((await handlePin(new Request("https://x/pin/abc1234", { method: "PATCH", body: "{" }), fakeClient(null))).status === 400);
  assert((await handlePin(new Request("https://x/pin/abc1234", { method: "OPTIONS" }), fakeClient(null))).status === 204);
});
