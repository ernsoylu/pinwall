import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CodeEditor } from "./CodeEditor";

// Shiki loads real grammars over dynamic imports; the keyboard behaviour is the
// point here, not the colours.
vi.mock("../lib/highlight", () => ({ highlight: () => Promise.resolve("") }));

function setup(value: string) {
  const onChange = vi.fn();
  render(<CodeEditor value={value} onChange={onChange} language="c" label="Pin content" />);
  return { onChange, area: screen.getByLabelText("Pin content") as HTMLTextAreaElement };
}

describe("CodeEditor tab handling", () => {
  it("indents at the caret instead of moving focus", async () => {
    const { onChange, area } = setup("int main()");
    area.focus();
    area.setSelectionRange(10, 10);

    await userEvent.tab();

    expect(onChange).toHaveBeenCalledWith("int main()  ");
    expect(document.activeElement).toBe(area);
  });

  it("indents every line a multi-line selection touches", async () => {
    const { onChange, area } = setup("a\nb\nc");
    area.focus();
    area.setSelectionRange(0, 3);

    await userEvent.tab();

    expect(onChange).toHaveBeenCalledWith("  a\n  b\nc");
  });

  it("outdents with shift+tab", async () => {
    const { onChange, area } = setup("  a\n  b");
    area.focus();
    area.setSelectionRange(0, 7);

    await userEvent.tab({ shift: true });

    expect(onChange).toHaveBeenCalledWith("a\nb");
  });

  // Trapping Tab outright would strand keyboard users in the textarea.
  it("lets Escape release the next Tab to the browser", async () => {
    const { onChange, area } = setup("x");
    area.focus();
    area.setSelectionRange(1, 1);

    await userEvent.keyboard("{Escape}");
    await userEvent.tab();

    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(area);
  });
});
