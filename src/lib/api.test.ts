import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
const rpc = vi.fn();
const maybeSingle = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    functions: { invoke },
    rpc,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  }),
}));

const { ApiError, createPin, getPin, newId, updatePin } = await import("./api");

/** Mirrors the pins_id_format check constraint in the database. */
const DB_ID_FORMAT = /^[A-Za-z0-9_-]{5,7}$/;

const httpError = (status: number, code: string) => ({
  context: new Response(JSON.stringify({ error: code }), { status }),
});

beforeEach(() => {
  invoke.mockReset();
  rpc.mockReset();
  maybeSingle.mockReset();
});

describe("newId", () => {
  it("always satisfies the database id constraint", () => {
    for (let i = 0; i < 500; i++) expect(newId()).toMatch(DB_ID_FORMAT);
  });
});

describe("createPin", () => {
  it("sends a generated id and the turnstile token", async () => {
    invoke.mockResolvedValue({ data: { id: "abc1234", edit_token: "tok" }, error: null });

    await createPin({ content: "hi", language: "typescript", turnstileToken: "t0ken" });

    const [name, options] = invoke.mock.calls[0];
    expect(name).toBe("create-pin");
    expect(options.body.token).toBe("t0ken");
    expect(options.body.id).toMatch(DB_ID_FORMAT);
    // The turnstile token must not be forwarded under its internal name.
    expect(options.body).not.toHaveProperty("turnstileToken");
  });

  it("retries with a new id when the short link is taken", async () => {
    invoke
      .mockResolvedValueOnce({ data: null, error: httpError(409, "id_taken") })
      .mockResolvedValueOnce({ data: { id: "xyz7890", edit_token: "tok" }, error: null });

    const result = await createPin({ content: "hi", language: "text", turnstileToken: "t" });

    expect(result.id).toBe("xyz7890");
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke.mock.calls[0][1].body.id).not.toBe(invoke.mock.calls[1][1].body.id);
  });

  it("gives up after the attempt budget", async () => {
    // Fresh Response per call: a body can only be read once.
    invoke.mockImplementation(async () => ({ data: null, error: httpError(409, "id_taken") }));

    await expect(
      createPin({ content: "hi", language: "text", turnstileToken: "t" }, 3),
    ).rejects.toThrow(ApiError);
    expect(invoke).toHaveBeenCalledTimes(3);
  });

  it("does not retry a turnstile rejection", async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(403, "turnstile_failed") });

    await expect(
      createPin({ content: "hi", language: "text", turnstileToken: "bad" }),
    ).rejects.toMatchObject({ code: "turnstile_failed" });
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});

describe("getPin", () => {
  it("never selects edit_token, which anon may not read", async () => {
    const select = vi.fn(() => ({ eq: () => ({ maybeSingle }) }));
    const { supabase } = await import("./api");
    vi.spyOn(supabase, "from").mockReturnValue({ select } as never);
    maybeSingle.mockResolvedValue({ data: null, error: null });

    await getPin("abc1234");

    expect(select.mock.calls[0][0]).not.toContain("edit_token");
    expect(select.mock.calls[0][0]).not.toContain("*");
  });
});

describe("updatePin", () => {
  it("sends plaintext for a public pin and nulls the encrypted columns", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await updatePin("abc1234", "tok", { content: "new" });

    expect(rpc.mock.calls[0][1]).toEqual({
      pin_id: "abc1234",
      new_content: "new",
      provided_token: "tok",
      new_ciphertext: null,
      new_iv: null,
    });
  });

  it("sends ciphertext for a private pin and never the plaintext", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await updatePin("abc1234", "tok", { ciphertext: "c1ph3r", iv: "1v" });

    expect(rpc.mock.calls[0][1]).toEqual({
      pin_id: "abc1234",
      new_content: null,
      provided_token: "tok",
      new_ciphertext: "c1ph3r",
      new_iv: "1v",
    });
  });

  it("reports a rejected edit token as false rather than throwing", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await updatePin("abc1234", "wrong", { content: "x" })).toBe(false);
  });
});
