import { useEffect, useRef, useState } from "react";
import { highlight } from "../lib/highlight";
import { Markdown } from "./Markdown";

/**
 * Shiki-highlighted editor: a highlighted layer sits under a transparent
 * textarea. Both layers use identical font metrics, padding and `pre`
 * whitespace so glyphs line up, and scrolling is mirrored.
 *
 * Markdown gets a Write/Preview pair here rather than in each caller, so the
 * creator and the viewer's edit mode both pick it up.
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
  const [preview, setPreview] = useState(false);
  const back = useRef<HTMLDivElement>(null);
  const front = useRef<HTMLTextAreaElement>(null);
  // Escape releases the next Tab to the browser, so keyboard users are never
  // trapped in the textarea by the indent handler below.
  const releaseTab = useRef(false);

  const isMarkdown = language === "markdown";
  // Switching the language away from markdown drops the preview on its own.
  const showPreview = isMarkdown && preview;

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
    <div className="flex min-h-0 flex-1 flex-col">
      {isMarkdown && (
        <div className="flex shrink-0 items-center gap-1 border-b border-line px-2 py-1.5">
          <Tab active={!preview} onClick={() => setPreview(false)}>
            Write
          </Tab>
          <Tab active={preview} onClick={() => setPreview(true)}>
            Preview
          </Tab>
        </div>
      )}

      {showPreview ? (
        <div className="min-h-0 flex-1 overflow-auto">
          {value.trim() === "" ? (
            <p className="p-4 text-[13px] text-fg-faint">Nothing to preview yet.</p>
          ) : (
            <Markdown source={value} />
          )}
        </div>
      ) : (
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
            onKeyDown={(e) => {
          if (e.key === "Escape") {
            releaseTab.current = true;
            return;
          }
          if (e.key === "Tab" && !releaseTab.current) {
            e.preventDefault();
            indent(e.currentTarget, e.shiftKey, onChange);
            return;
          }
          releaseTab.current = false;
        }}
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
      )}
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded px-2.5 py-1 font-mono text-[11px] transition-colors ${
        active ? "bg-surface-2 text-fg" : "text-fg-faint hover:text-fg-muted"
      }`}
    >
      {children}
    </button>
  );
}

const INDENT = "  ";

/**
 * Tab indents instead of moving focus. Edits go through execCommand where it
 * exists so the browser's own undo stack survives — rewriting value through
 * React would make Ctrl+Z throw away the whole pin.
 */
function indent(el: HTMLTextAreaElement, outdent: boolean, onChange: (v: string) => void) {
  const { selectionStart: start, selectionEnd: end, value } = el;

  const apply = (from: number, to: number, text: string, caret: [number, number]) => {
    el.setSelectionRange(from, to);
    let ok = false;
    try {
      ok = document.execCommand("insertText", false, text);
    } catch {
      ok = false;
    }
    if (!ok) onChange(value.slice(0, from) + text + value.slice(to));
    el.setSelectionRange(...caret);
  };

  // A caret, or a selection inside one line: just drop an indent in.
  if (!outdent && !value.slice(start, end).includes("\n")) {
    apply(start, end, INDENT, [start + INDENT.length, start + INDENT.length]);
    return;
  }

  // Otherwise rewrite every line the selection touches, so a block keeps its shape.
  const from = value.lastIndexOf("\n", start - 1) + 1;
  const nextBreak = value.indexOf("\n", end);
  const to = nextBreak === -1 ? value.length : nextBreak;
  const block = value.slice(from, to);
  const text = outdent ? block.replace(/^ {1,2}/gm, "") : block.replace(/^/gm, INDENT);

  apply(from, to, text, [from, from + text.length]);
}
