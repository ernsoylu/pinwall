import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { encrypt } from "../lib/crypto";

const getPin = vi.fn();
const updatePin = vi.fn();

vi.mock("../lib/api", () => ({ getPin, updatePin }));
// Shiki loads real grammars; the viewer's job here is the decrypt flow, not colours.
vi.mock("../components/CodeBlock", () => ({
  CodeBlock: ({ code }: { code: string }) => <pre>{code}</pre>,
}));

const { Viewer } = await import("./Viewer");

const basePin = { id: "abc1234", language: "text", created_at: new Date().toISOString() };

beforeEach(() => {
  getPin.mockReset();
  updatePin.mockReset();
});

describe("Viewer", () => {
  it("shows a public pin without asking for a passphrase", async () => {
    getPin.mockResolvedValue({ ...basePin, content: "hello world", ciphertext: null, iv: null });

    render(<Viewer id="abc1234" editToken={null} />);

    expect(await screen.findByText("hello world")).toBeInTheDocument();
    expect(screen.queryByLabelText("Passphrase")).not.toBeInTheDocument();
  });

  it("decrypts a private pin in the browser with the right passphrase", async () => {
    const { ciphertext, iv } = await encrypt("classified", "correct horse");
    getPin.mockResolvedValue({ ...basePin, content: null, ciphertext, iv });

    render(<Viewer id="abc1234" editToken={null} />);

    await userEvent.type(await screen.findByLabelText("Passphrase"), "correct horse");
    await userEvent.click(screen.getByRole("button", { name: /unlock/i }));

    expect(await screen.findByText("classified")).toBeInTheDocument();
    expect(screen.getByText("Decrypted locally")).toBeInTheDocument();
  });

  it("reports a wrong passphrase and keeps the pin locked", async () => {
    const { ciphertext, iv } = await encrypt("classified", "correct horse");
    getPin.mockResolvedValue({ ...basePin, content: null, ciphertext, iv });

    render(<Viewer id="abc1234" editToken={null} />);

    await userEvent.type(await screen.findByLabelText("Passphrase"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /unlock/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong passphrase.");
    expect(screen.queryByText("classified")).not.toBeInTheDocument();
  });

  it("hides Edit unless an edit token is present in the URL fragment", async () => {
    getPin.mockResolvedValue({ ...basePin, content: "hi", ciphertext: null, iv: null });

    const { unmount } = render(<Viewer id="abc1234" editToken={null} />);
    await screen.findByText("hi");
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    unmount();

    render(<Viewer id="abc1234" editToken="tok-123" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument());
  });

  it("re-encrypts with the same passphrase when editing a private pin", async () => {
    const { ciphertext, iv } = await encrypt("v1", "pw");
    getPin.mockResolvedValue({ ...basePin, content: null, ciphertext, iv });
    updatePin.mockResolvedValue(true);

    render(<Viewer id="abc1234" editToken="tok-123" />);

    await userEvent.type(await screen.findByLabelText("Passphrase"), "pw");
    await userEvent.click(screen.getByRole("button", { name: /unlock/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));

    const box = screen.getByLabelText("Edit pin content");
    await userEvent.clear(box);
    await userEvent.type(box, "v2");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updatePin).toHaveBeenCalled());
    const payload = updatePin.mock.calls[0][2];
    // The plaintext must never reach the network.
    expect(payload).not.toHaveProperty("content");
    expect(payload.ciphertext).toBeTruthy();
    expect(atob(payload.ciphertext)).not.toContain("v2");
  });

  it("surfaces a rejected edit token", async () => {
    getPin.mockResolvedValue({ ...basePin, content: "hi", ciphertext: null, iv: null });
    updatePin.mockResolvedValue(false);

    render(<Viewer id="abc1234" editToken="bad" />);

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("not valid");
  });

  it("says so when the pin does not exist", async () => {
    getPin.mockResolvedValue(null);
    render(<Viewer id="nope99" editToken={null} />);
    expect(await screen.findByText("No pin at /nope99.")).toBeInTheDocument();
  });
});
