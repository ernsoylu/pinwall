import type { HighlighterCore } from "shiki/core";

// Fine-grained bundle: importing "shiki" directly would pull in every grammar
// it ships (wolfram, emacs-lisp, verilog…). Only these are ever loaded, one chunk each.
const LANG_LOADERS = {
  text: null,
  typescript: () => import("@shikijs/langs/typescript"),
  javascript: () => import("@shikijs/langs/javascript"),
  tsx: () => import("@shikijs/langs/tsx"),
  jsx: () => import("@shikijs/langs/jsx"),
  python: () => import("@shikijs/langs/python"),
  go: () => import("@shikijs/langs/go"),
  rust: () => import("@shikijs/langs/rust"),
  java: () => import("@shikijs/langs/java"),
  c: () => import("@shikijs/langs/c"),
  cpp: () => import("@shikijs/langs/cpp"),
  sql: () => import("@shikijs/langs/sql"),
  json: () => import("@shikijs/langs/json"),
  yaml: () => import("@shikijs/langs/yaml"),
  bash: () => import("@shikijs/langs/bash"),
  html: () => import("@shikijs/langs/html"),
  css: () => import("@shikijs/langs/css"),
  markdown: () => import("@shikijs/langs/markdown"),
} as const;

export const LANGUAGES = Object.keys(LANG_LOADERS) as Language[];

export type Language = keyof typeof LANG_LOADERS;

export const isLanguage = (v: string): v is Language => v in LANG_LOADERS;

const THEME = "everforest-dark";

let core: Promise<HighlighterCore> | null = null;
const loaded = new Set<string>(["text"]);

function getCore() {
  // Dynamic so Shiki's core lands in its own chunk instead of the entry bundle.
  core ??= Promise.all([import("shiki/core"), import("shiki/engine/javascript")]).then(
    ([{ createHighlighterCore }, { createJavaScriptRegexEngine }]) =>
      createHighlighterCore({
        themes: [import("@shikijs/themes/everforest-dark")],
        langs: [],
        // The JS regex engine avoids shipping the ~600 kB Oniguruma wasm blob.
        engine: createJavaScriptRegexEngine(),
      }),
  );
  return core;
}

export async function highlight(code: string, lang: string) {
  const language: Language = isLanguage(lang) ? lang : "text";
  const shiki = await getCore();

  const load = LANG_LOADERS[language];
  if (load && !loaded.has(language)) {
    await shiki.loadLanguage(await load());
    loaded.add(language);
  }

  return shiki.codeToHtml(code, { lang: language, theme: THEME });
}
