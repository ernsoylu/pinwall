import { describe, expect, it } from "vitest";
import { WrongPassphraseError, decrypt, encrypt } from "./crypto";

describe("crypto", () => {
  it("round-trips text through encrypt/decrypt", async () => {
    const { ciphertext, iv } = await encrypt("const a = 1", "hunter2");
    expect(await decrypt(ciphertext, iv, "hunter2")).toBe("const a = 1");
  });

  it("round-trips unicode and long input", async () => {
    const text = "🔐 çğıöşü\n".repeat(5000);
    const { ciphertext, iv } = await encrypt(text, "pass");
    expect(await decrypt(ciphertext, iv, "pass")).toBe(text);
  });

  it("rejects a wrong passphrase", async () => {
    const { ciphertext, iv } = await encrypt("secret", "right");
    await expect(decrypt(ciphertext, iv, "wrong")).rejects.toThrow(WrongPassphraseError);
  });

  it("rejects a tampered ciphertext", async () => {
    const { ciphertext, iv } = await encrypt("secret", "pass");
    const bytes = atob(ciphertext).split("");
    bytes[bytes.length - 1] = String.fromCharCode(bytes[bytes.length - 1].charCodeAt(0) ^ 0xff);
    await expect(decrypt(btoa(bytes.join("")), iv, "pass")).rejects.toThrow(WrongPassphraseError);
  });

  it("rejects a payload too short to hold a salt", async () => {
    await expect(decrypt(btoa("short"), btoa("0123456789ab"), "pass")).rejects.toThrow(
      WrongPassphraseError,
    );
  });

  it("uses a fresh salt and iv per call, so identical inputs differ", async () => {
    const a = await encrypt("same", "same");
    const b = await encrypt("same", "same");
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
  });

  it("never leaks the plaintext into the stored payload", async () => {
    const { ciphertext, iv } = await encrypt("TOP_SECRET_MARKER", "pass");
    expect(atob(ciphertext)).not.toContain("TOP_SECRET_MARKER");
    expect(ciphertext + iv).not.toContain("TOP_SECRET_MARKER");
  });
});
