import { useEffect, useState } from "react";
import { highlight } from "../lib/highlight";

export function CodeBlock({ code, language }: { code: string; language: string }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    highlight(code, language).then((h) => !stale && setHtml(h));
    return () => {
      stale = true;
    };
  }, [code, language]);

  // Until Shiki resolves, show the same text unstyled so the layout doesn't jump.
  if (!html) {
    return (
      <pre className="overflow-x-auto p-4 font-mono text-[13px]/[1.5] text-fg-muted">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div
      className="overflow-x-auto p-4 font-mono text-[13px]/[1.5] [&_pre]:!bg-transparent"
      // Shiki returns sanitised HTML built from the code string, not raw user markup.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
