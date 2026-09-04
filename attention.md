# Attention

Things that need a human eye before they are changed. Delete an entry once it
stops being true.

## Rendered markdown must stay sanitised

`src/lib/markdown.ts` runs every pin through DOMPurify before
`src/components/Markdown.tsx` hands it to `dangerouslySetInnerHTML`.

Pin text is untrusted — anyone can create a pin without an account — and a
rendered page can be holding decrypted private pin text in memory at the same
time. Dropping the sanitiser is not a cosmetic regression: it is an XSS that can
read a private pin the viewer just unlocked.

`src/lib/markdown.test.ts` pins the behaviour for script tags, inline event
handlers, `javascript:` URLs and HTML written as markdown text. Keep it green.

## Never call `turnstile.reset()`

The widget renders with `appearance: "interaction-only"` so it stays out of the
layout unless a challenge is actually needed. A widget reset that way stays
hidden even when the retry does need an interaction, which strands the visitor
on a permanently disabled submit button:
<https://community.cloudflare.com/t/bug-widget-not-displayed-in-interaction-only-mode-after-turnstile-reset-usability-suggestion/579897>

`src/components/Turnstile.tsx` sidesteps it by removing the widget and rendering
a fresh one whenever `resetKey` changes. Keep that shape.

## The editor's Tab handler has two load-bearing details

`src/components/CodeEditor.tsx` intercepts Tab so it indents instead of moving
focus. Two things there are not incidental:

- **Escape releases the next Tab.** Without it the textarea is a keyboard trap:
  a keyboard-only visitor who tabs in can never tab out.
- **Edits go through `document.execCommand("insertText")`.** It is deprecated,
  but it is the only way to indent a textarea while keeping the browser's own
  undo stack. Writing the value back through React instead makes Ctrl+Z discard
  the entire pin in one step. The React path is only a fallback for where
  execCommand is unavailable.

`src/components/CodeEditor.test.tsx` covers both.

## Deliberately skipped

- **Shiki inside rendered markdown.** Fenced code blocks in a rendered markdown
  pin are styled but not syntax-highlighted, even though Shiki is already
  loaded for the source view. Worth wiring up if markdown pins turn out to be
  mostly code.
