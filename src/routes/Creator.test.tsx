import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("../lib/api", () => ({ createPin: vi.fn().mockResolvedValue({ id: "abc1234", edit_token: "token" }) }));
vi.mock("../components/Turnstile", () => ({
  Turnstile: ({ onToken }: { onToken: (token: string) => void }) =>
    <button onClick={() => onToken("verified")}>Verify</button>,
}));
vi.mock("../components/CodeEditor", () => ({
  CodeEditor: ({ value, onChange, language }: { value: string; onChange: (value: string) => void; language: string }) =>
    <textarea aria-label="Pin content" data-language={language} value={value} onChange={(event) => onChange(event.target.value)} />,
}));
vi.mock("./ShareModal", () => ({ ShareModal: () => null }));

import { Creator } from "./Creator";
import { createPin } from "../lib/api";

it("starts in Markdown, detects content, honors overrides, and saves the detected language", async () => {
  render(<Creator />);
  const editor = screen.getByRole("textbox", { name: "Pin content" });
  const picker = screen.getByRole("combobox", { name: /Language/ });
  expect(editor).toHaveAttribute("data-language", "markdown");
  fireEvent.change(editor, { target: { value: "def hello():\n    pass" } });
  expect(editor).toHaveAttribute("data-language", "python");
  fireEvent.change(picker, { target: { value: "markdown" } });
  fireEvent.change(editor, { target: { value: 'const name = "pinwall";' } });
  expect(editor).toHaveAttribute("data-language", "markdown");
  fireEvent.change(picker, { target: { value: "auto" } });
  expect(editor).toHaveAttribute("data-language", "javascript");
  fireEvent.click(screen.getByRole("button", { name: "Verify" }));
  fireEvent.click(screen.getByRole("button", { name: "Deposit" }));
  await waitFor(() => expect(createPin).toHaveBeenCalledWith(expect.objectContaining({
    language: "javascript", content: 'const name = "pinwall";',
  })));
});
