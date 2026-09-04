import { Code2, KeyRound } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/Button";
import { CodeEditor } from "../components/CodeEditor";
import { LabelGrid, Shell } from "../components/Shell";
import { Turnstile } from "../components/Turnstile";
import { ShareModal } from "./ShareModal";
import { createPin } from "../lib/api";
import { encrypt } from "../lib/crypto";
import { LANGUAGES } from "../lib/highlight";
import { dateStamp } from "../lib/time";

export function Creator() {
  const [body, setBody] = useState("");
  const [language, setLanguage] = useState("typescript");
  const [expiry, setExpiry] = useState("");
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
      setCreated(
        await createPin({
          ...payload,
          language,
          turnstileToken: token!,
          expires_at: expiry ? new Date(`${expiry}T23:59:59.999`).toISOString() : null,
        }),
      );
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
      notice="A sealed deposit is encrypted in this browser — the counter receives ciphertext it holds no key for"
    >
      {/* The deposit plate: ruled, dated, and open before a character is typed. */}
      <div className="plate relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[3px]">
        {/* The seal closing across the whole deposit, from its hinge. */}
        {isPrivate && (
          <span
            aria-hidden
            className="seal-band pointer-events-none absolute inset-x-0 top-0 z-10 h-[3px] bg-brass"
          />
        )}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-ticket-rule px-4 py-2.5">
          <LabelGrid
            tag={<span className="text-ink-faint">not issued</span>}
            deposited={dateStamp()}
            keepUntil={
              <span className="relative inline-flex">
                {!expiry && (
                  <span className="pointer-events-none absolute left-0 text-ink-muted">
                    infinite
                  </span>
                )}
                <input
                  type="date"
                  aria-label="Keep until"
                  min={new Date().toLocaleDateString("en-CA")}
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className={
                    "w-[7.25rem] min-w-0 cursor-pointer bg-transparent outline-none " +
                    (expiry ? "text-ink-muted" : "text-transparent")
                  }
                />
              </span>
            }
            seal={
              isPrivate ? (
                <span className="stamp -my-0.5 inline-block rounded-[2px] border border-oxblood px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-oxblood">
                  Sealed
                </span>
              ) : (
                <span className="text-ink-faint">open</span>
              )
            }
          />
          <span className="tabular shrink-0 font-mono text-[11px] text-ink-faint">
            {body.length.toLocaleString()} chars
          </span>
        </div>
        <CodeEditor
          value={body}
          onChange={setBody}
          language={language}
          label="Pin content"
          placeholder="Paste or type here…"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-[3px] border border-oxblood bg-oxblood/15 px-3 py-2 text-[12.5px] text-ink"
        >
          {error}
        </p>
      )}

      {/* The deposit terms, read as one line of conditions with the action at its end. */}
      <div className="flex shrink-0 flex-col gap-2.5 rounded-[3px] border border-enamel-lit bg-enamel p-2.5 sm:flex-row sm:items-center sm:gap-0 sm:py-1.5 sm:pl-3.5 sm:pr-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap">
          <label className="flex shrink-0 items-center gap-2">
            <Code2 className="size-3.5 shrink-0 text-on-enamel" aria-hidden />
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.11em] text-on-enamel md:inline">
              Deposit as
            </span>
            <span className="sr-only">Language</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="picker cursor-pointer rounded-[2px] bg-transparent py-1 font-mono text-[12px] font-medium text-ink outline-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l} className="bg-enamel-deep">
                  {l}
                </option>
              ))}
            </select>
          </label>

          <Divider />

          <button
            type="button"
            role="switch"
            aria-checked={isPrivate}
            onClick={() => setPrivate((v) => !v)}
            className={`shrink-0 rounded-[2px] border px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors ${
              isPrivate
                ? "border-brass bg-brass text-enamel-deep"
                : "border-dashed border-on-enamel/60 text-on-enamel hover:border-brass-lit hover:text-brass-lit"
            }`}
          >
            {isPrivate ? "Sealed" : "Seal it"}
          </button>

          {isPrivate && (
            <>
              <Divider />
              <label className="flex min-w-0 basis-full items-center gap-2 sm:basis-auto">
                <KeyRound className="size-3.5 shrink-0 text-brass-lit" aria-hidden />
                <span className="sr-only">Passphrase</span>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="passphrase"
                  autoComplete="new-password"
                  className="w-full min-w-0 rounded-[2px] bg-transparent py-1 font-mono text-[12px] text-ink caret-brass-lit outline-none placeholder:text-on-enamel sm:w-44 sm:flex-none"
                />
              </label>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
          <Turnstile
            onToken={setToken}
            onError={(code) => setError(turnstileMessage(code))}
            resetKey={resetKey}
          />
          <Button onClick={submit} disabled={!canSubmit} className="px-4 py-2">
            {busy ? "Depositing…" : "Deposit"}
          </Button>
        </div>
      </div>

      {created && (
        <ShareModal
          id={created.id}
          editToken={created.edit_token}
          isPrivate={isPrivate}
          language={language}
          onClose={() => setCreated(null)}
        />
      )}
    </Shell>
  );
}

function Divider() {
  return <span aria-hidden className="hidden h-4 w-px shrink-0 bg-enamel-lit sm:block" />;
}

function messageFor(code: string) {
  switch (code) {
    case "turnstile_failed":
      return "Verification failed. Try again.";
    case "turnstile_misconfigured":
      return "Verification is unavailable (server key misconfigured).";
    case "id_taken":
      return "Could not find a free tag. Try again.";
    case "too_large":
      return "That pin is over the 256 KB limit.";
    default:
      return "Could not take the deposit. Try again.";
  }
}

// Codes Cloudflare marks non-retryable: the site is misconfigured, not the visitor.
const FATAL = ["missing_sitekey", "400020", "400070", "110100", "110110", "110200"];

function turnstileMessage(code: string) {
  return FATAL.includes(code)
    ? `Verification is unavailable (Turnstile ${code}). This is a site misconfiguration.`
    : `Verification failed (${code}). Try again.`;
}
