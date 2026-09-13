import type { Language } from "./highlight";

export function detectLanguage(content: string): Language {
  const trimmed = content.trim();
  if (!trimmed) return "markdown";
  if ((trimmed.startsWith("{") || trimmed.startsWith("["))) {
    try { JSON.parse(trimmed); return "json"; } catch { /* Keep checking incomplete code. */ }
  }
  // ponytail: bounded syntax hints, not a parser; manual selection handles ambiguous snippets.
  const code = trimmed.slice(0, 16000);
  if (/^```|^~~~|^#{1,6}\s+\S|^\s*[-*+] \[[ xX]\] /m.test(code) ||
    /\[[^\]\n]+\]\(\S+\)|\*\*[^*\n]+\*\*/.test(code)) return "markdown";
  if (/^#!.*\b(?:ba|z|k)?sh\b|^\s*(?:export\s+\w+=|(?:sudo |curl |echo |printf ).+)|\bthen\s*\n/m.test(code)) return "bash";
  if (/^\s*(?:from\s+[\w.]+\s+import\s|(?:async\s+)?def\s+\w+\s*\(|class\s+\w+[^\n]*:)|^#!.*\bpython\d*\b/m.test(code)) return "python";
  if (/^\s*(?:package\s+\w+\s*$|func\s+(?:\([^)]*\)\s*)?\w+\s*\()/m.test(code)) return "go";
  if (/^\s*(?:(?:pub\s+)?(?:async\s+)?fn\s+\w+|use\s+\w+::)|\b(?:println!|let\s+mut\s)/m.test(code)) return "rust";
  if (/\b(?:public\s+(?:static\s+)?(?:class|void)|System\.out\.println)\b|^\s*import\s+java\./m.test(code)) return "java";
  if (/\bstd::|^\s*#include\s*<(?:(?:i|o)ostream|vector|string|map)>/m.test(code)) return "cpp";
  if (/^\s*#\s*include\s*[<"]|\b(?:int|void)\s+main\s*\(/m.test(code)) return "c";
  if (/^\s*(?:SELECT\s+.+\s+FROM\b|INSERT\s+INTO\b|CREATE\s+TABLE\b|UPDATE\s+\w+\s+SET\b|DELETE\s+FROM\b)/im.test(code)) return "sql";
  if (/^[^{\n]+\{\s*(?:--[\w-]+|[a-z-]+)\s*:\s*[^}\n]+[;}]/m.test(code)) return "css";
  const typed = /\b(?:interface\s+\w+\s*[{<]|type\s+\w+\s*=)|\b\w+\??\s*:\s*(?:string|number|boolean|unknown|never)\b/.test(code);
  const jsx = /(?:\breturn\s*\(?|=>\s*\(?|=)\s*<[A-Za-z][\w.]*\b/.test(code);
  if (jsx) return typed ? "tsx" : "jsx";
  if (/<!doctype\s+html|<([a-z][\w-]*)\b[^>]*>[\s\S]*<\/\1\s*>|^\s*<(?:img|input|br|hr)\b/i.test(code)) return "html";
  if (typed) return "typescript";
  if (/\b(?:const|let|var)\s+[\w$]+\s*=|\bfunction\s*[\w$]*\s*\(|=>|\bconsole\.log\s*\(|^\s*(?:import|export)\s/m.test(code)) return "javascript";
  if ((code.match(/^\s*[\w.-]+:\s+\S/gm)?.length ?? 0) >= 2 ||
    /^---\s*\n[\s\S]*?^[\w.-]+:\s/m.test(code)) return "yaml";
  if (/^\s*(?:[-*+]|\d+\.)\s+\S.*\n\s*(?:[-*+]|\d+\.)\s+\S|^>\s+\S|^.+\n(?:={3,}|-{3,})\s*$/m.test(code)) return "markdown";
  return "text";
}
