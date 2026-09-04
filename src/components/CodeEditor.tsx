import { useEffect, useRef, useState } from "react";
import { highlight } from "../lib/highlight";

/**
 * Shiki-highlighted editor: a highlighted layer sits under a transparent
 * textarea. Both layers use identical font metrics, padding and `pre`
 * whitespace so glyphs line up, and scrolling is mirrored.
 *
 * ponytail: overlay rather than a real editor widget. If selection decorations
 * or folding are ever needed, that's the point to reach for CodeMirror.
 */
export function CodeEditor({
  value,
  onChange,
  language,
  label,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  language: string;
  label: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const back = useRef<HTMLDivElement>(null);
  const front = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let stale = false;
    // Trailing newline keeps the last line's box alive while typing.
    highlight(value + "\n", language).then((h) => !stale && setHtml(h));
    return () => {
      stale = true;
    };
  }, [value, language]);

  const layer = "p-3.5 font-mono text-[13px]/[1.55] whitespace-pre";

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={back}
        aria-hidden
        className={`pointer-events-none absolute inset-0 overflow-hidden ${layer} [&_code]:font-inherit [&_pre]:m-0 [&_pre]:!bg-transparent [&_pre]:p-0`}
        dangerouslySetInnerHTML={{ __html: html ?? "" }}
      />
      <textarea
        ref={front}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={() => {
          if (!back.current || !front.current) return;
          back.current.scrollTop = front.current.scrollTop;
          back.current.scrollLeft = front.current.scrollLeft;
        }}
        wrap="off"
        spellCheck={false}
        autoFocus={autoFocus}
        aria-label={label}
        placeholder={placeholder}
        className={`absolute inset-0 resize-none overflow-auto bg-transparent outline-none placeholder:text-fg-faint ${layer} ${
          html ? "text-transparent caret-fg" : "text-fg-muted caret-fg"
        }`}
      />
    </div>
  );
}
