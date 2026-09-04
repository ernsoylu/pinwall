import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("renders common markdown", async () => {
    const html = await renderMarkdown("# Title\n\nSome **bold** text.\n\n- one\n- two");
    expect(html).toContain("<h1");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<li>one</li>");
  });

  it("renders GFM tables and fenced code", async () => {
    const html = await renderMarkdown("| a | b |\n| - | - |\n| 1 | 2 |\n\n```js\nlet x = 1;\n```");
    expect(html).toContain("<table>");
    expect(html).toContain("<code");
  });

  // Anyone can create a pin, and the rendered page also holds decrypted private
  // pin text in memory, so unsanitised markup here would be a real XSS.
  it("strips script tags", async () => {
    const html = await renderMarkdown("hi\n\n<script>alert(1)</script>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });

  it("strips inline event handlers", async () => {
    const html = await renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain("onerror");
  });

  it("strips javascript: links", async () => {
    const html = await renderMarkdown("[click](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });

  it("escapes html written as markdown text", async () => {
    const html = await renderMarkdown("`<script>alert(1)</script>`");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;");
  });
});
