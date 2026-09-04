import { useEffect, useState } from "react";
import { renderMarkdown } from "../lib/markdown";

export function Markdown({ source }: { source: string }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    renderMarkdown(source).then((h) => !stale && setHtml(h));
    return () => {
      stale = true;
    };
  }, [source]);

  if (html === null) {
    return <div className="p-4 text-[13px] text-fg-muted">Rendering…</div>;
  }

  return (
    <div
      className="markdown p-4 sm:p-5"
      // renderMarkdown runs the output through DOMPurify before it gets here.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
