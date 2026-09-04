// Dynamic so marked and DOMPurify land in their own chunk: a pin is only ever
// markdown some of the time, and neither belongs in the entry bundle.
let deps: Promise<[typeof import("marked"), typeof import("dompurify")]> | null = null;

/**
 * Markdown to HTML. Pin text is untrusted — anyone can create a pin, and the
 * result is injected into a page that holds a decrypted private pin in memory —
 * so the output is always sanitised before it is returned.
 */
export async function renderMarkdown(source: string): Promise<string> {
  const [{ marked }, { default: DOMPurify }] = await (deps ??= Promise.all([
    import("marked"),
    import("dompurify"),
  ]));

  const html = await marked.parse(source, { async: true, gfm: true });
  return DOMPurify.sanitize(html);
}
