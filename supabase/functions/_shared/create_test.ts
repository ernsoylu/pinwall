import { createPin, type Protection } from "./create.ts";

const assert: (value: unknown, message?: string) => asserts value = (value, message = "assertion failed") => {
  if (!value) throw new Error(message);
};
const body = { id: "abc1234", language: "text", content: "hello" };
const request = (value: unknown) => new Request("https://example.test", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value),
});
const allow: Protection = async () => null;

Deno.test("create validates every trust-boundary field", async () => {
  for (const [change, status] of [
    [{ id: "bad" }, 400], [{ language: "UPPER SPACE" }, 400], [{ content: "" }, 400],
    [{ ciphertext: "sealed", content: undefined }, 400], [{ expires_at: "yesterday" }, 400],
  ] as const) {
    const response = await createPin(request({ ...body, ...change }), allow, async () => null);
    assert(response.status === status, `${JSON.stringify(change)} returned ${response.status}`);
  }
  const response = await createPin(request({ ...body, content: "x".repeat(262145) }), allow, async () => null);
  assert(response.status === 413);
});

Deno.test("create applies protection before inserting", async () => {
  let inserted = false;
  const response = await createPin(request(body), async () => ({ error: "blocked", status: 429 }), async () => {
    inserted = true; return null;
  });
  assert(response.status === 429 && !inserted);
});

Deno.test("create returns edit token and maps collisions", async () => {
  const ok = await createPin(request(body), allow, async (row) => {
    assert(row.content === "hello" && typeof row.edit_token === "string"); return null;
  });
  assert(ok.status === 201 && (await ok.json()).id === "abc1234");
  const collision = await createPin(request(body), allow, async () => ({ code: "23505" }));
  assert(collision.status === 409);
});

Deno.test("create handles method and malformed JSON", async () => {
  assert((await createPin(new Request("https://x", { method: "GET" }), allow)).status === 405);
  assert((await createPin(new Request("https://x", { method: "POST", body: "{" }), allow)).status === 400);
  assert((await createPin(new Request("https://x", { method: "OPTIONS" }), allow)).status === 204);
});
