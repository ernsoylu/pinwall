import { Code, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/Button";
import { Shell } from "../components/Shell";
import { Turnstile } from "../components/Turnstile";
import { ShareModal } from "./ShareModal";
import { createPin } from "../lib/api";
import { encrypt } from "../lib/crypto";
import { LANGUAGES } from "../lib/highlight";

export function Creator() {
  const [body, setBody] = useState("");
  const [language, setLanguage] = useState("typescript");
  const [isPrivate, setPrivate] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; edit_token: string } | null>(null);

  const canSubmit = body.trim() !== "" && !!token && !busy && (!isPrivate || passphrase !== "");

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const payload = isPrivate
        ? await encrypt(body, passphrase)
        : { content: body };
      setCreated(await createPin({ ...payload, language, turnstileToken: token! }));
    } catch (e) {
      setError(messageFor((e as Error).message));
      setToken(null);
      setResetKey((k) => k + 1); // Turnstile tokens are single-use.
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      actions={
        <span className="hidden items-center gap-2 text-xs text-fg-faint sm:flex">
          <ShieldCheck className="size-[13px]" />
          anonymous · encrypted in your browser
        </span>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-surface">
        <div className="flex shrink-0 items-center justify-between border-b border-line px-3.5 py-2.5">
          <span className="font-mono text-xs text-fg-muted">untitled</span>
          <span className="font-mono text-xs text-fg-faint">{body.length} chars</span>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          spellCheck={false}
          aria-label="Pin content"
          placeholder="Paste or type here…"
          className="min-h-0 flex-1 resize-none bg-transparent p-3.5 font-mono text-[13px]/[1.55] text-fg-muted outline-none placeholder:text-fg-faint"
        />
      </div>

      {error && (
        <p role="alert" className="text-xs text-accent">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2.5 text-sm">
            <Code className="size-3.5 text-fg-muted" />
            <span className="sr-only">Language</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent font-medium outline-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l} className="bg-surface">
                  {l}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            role="switch"
            aria-checked={isPrivate}
            onClick={() => setPrivate((v) => !v)}
            className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium ${
              isPrivate ? "border-accent bg-surface-2" : "border-line bg-surface"
            }`}
          >
            <Lock className={`size-3.5 ${isPrivate ? "text-accent" : "text-fg-muted"}`} />
            Private
            <span
              className={`ml-1 flex h-4 w-7 items-center rounded-full p-0.5 ${
                isPrivate ? "justify-end bg-accent" : "justify-start bg-line"
              }`}
            >
              <span className="size-3 rounded-full bg-white" />
            </span>
          </button>

          {isPrivate && (
            <label className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2.5">
              <KeyRound className="size-3.5 text-fg-faint" />
              <span className="sr-only">Passphrase</span>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="passphrase"
                className="w-40 bg-transparent font-mono text-[13px] outline-none placeholder:text-fg-faint"
              />
            </label>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <Turnstile
            onToken={setToken}
            onError={(code) => setError(turnstileMessage(code))}
            resetKey={resetKey}
          />
          <Button onClick={submit} disabled={!canSubmit}>
            {busy ? "Creating…" : "Create pin"}
          </Button>
        </div>
      </div>

      {created && (
        <ShareModal
          id={created.id}
          editToken={created.edit_token}
          isPrivate={isPrivate}
          onClose={() => setCreated(null)}
        />
      )}
    </Shell>
  );
}

function messageFor(code: string) {
  switch (code) {
    case "turnstile_failed":
      return "Verification failed. Try again.";
    case "turnstile_misconfigured":
      return "Verification is unavailable (server key misconfigured).";
    case "id_taken":
      return "Could not find a free short link. Try again.";
    case "too_large":
      return "That pin is over the 256 KB limit.";
    default:
      return "Could not create the pin. Try again.";
  }
}

// Codes Cloudflare marks non-retryable: the site is misconfigured, not the visitor.
const FATAL = ["missing_sitekey", "400020", "400070", "110100", "110110", "110200"];

function turnstileMessage(code: string) {
  return FATAL.includes(code)
    ? `Verification is unavailable (Turnstile ${code}). This is a site misconfiguration.`
    : `Verification failed (${code}). Try again.`;
}
