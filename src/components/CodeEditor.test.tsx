import { cleanup, render, screen } from "@testing-library/react";
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

describe("CodeEditor line numbers", () => {
  const rail = () => document.querySelector('[data-testid="line-numbers"]') as HTMLElement;

  it("numbers every line, and only the lines that exist", () => {
    setup("a\nb\nc");
    expect(rail().textContent).toBe("1\n2\n3");
  });

  it("counts the trailing blank line a final newline creates", () => {
    setup("a\n");
    expect(rail().textContent).toBe("1\n2");
  });

  // The rail sits over the text layers, so it must stay out of the accessibility
  // tree and out of any selection — a copied pin that carried "1 2 3" would be
  // corrupt, and pasting it back is the obvious way someone would notice.
  it("stays unselectable and hidden from assistive tech", () => {
    setup("a\nb");
    expect(rail()).toHaveAttribute("aria-hidden", "true");
    expect(rail().className).toContain("select-none");
    expect(rail().className).toContain("pointer-events-none");
  });

  it("widens for line counts that need more digits", () => {
    setup("x");
    expect(rail().style.width).toContain("1ch");
    cleanup();
    setup(Array.from({ length: 120 }, (_, i) => i).join("\n"));
    expect(rail().style.width).toContain("3ch");
  });
});
