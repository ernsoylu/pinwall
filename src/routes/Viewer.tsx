import { FileText, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { CodeBlock } from "../components/CodeBlock";
import { CopyButton } from "../components/CopyButton";
import { Shell } from "../components/Shell";
import { getPin, updatePin, type Pin } from "../lib/api";
import { WrongPassphraseError, decrypt, encrypt } from "../lib/crypto";

type State =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error"; message: string }
  | { status: "locked"; pin: Pin }
  | { status: "ready"; pin: Pin; text: string; passphrase?: string };

export function Viewer({ id, editToken }: { id: string; editToken: string | null }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let stale = false;
    getPin(id)
      .then((pin) => {
        if (stale) return;
        if (!pin) return setState({ status: "missing" });
        setState(
          pin.ciphertext
            ? { status: "locked", pin }
            : { status: "ready", pin, text: pin.content ?? "" },
        );
      })
      .catch(() => !stale && setState({ status: "error", message: "Could not load this pin." }));
    return () => {
      stale = true;
    };
  }, [id]);

  if (state.status === "loading") return <Centered>Loading…</Centered>;
  if (state.status === "missing") return <Centered>No pin at /{id}.</Centered>;
  if (state.status === "error") return <Centered>{state.message}</Centered>;
  if (state.status === "locked")
    return <Unlock pin={state.pin} onOpen={(text, passphrase) => setState({ status: "ready", pin: state.pin, text, passphrase })} />;

  return <Ready state={state} editToken={editToken} onText={(text) => setState({ ...state, text })} />;
}

function Ready({
  state,
  editToken,
  onText,
}: {
  state: Extract<State, { status: "ready" }>;
  editToken: string | null;
  onText: (text: string) => void;
}) {
  const { pin, text, passphrase } = state;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = passphrase ? await encrypt(draft, passphrase) : { content: draft };
      const ok = await updatePin(pin.id, editToken!, payload);
      if (!ok) return setError("That edit token is not valid for this pin.");
      onText(draft);
      setEditing(false);
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell
      actions={
        <>
          {!editing && (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Raw"
                title="Raw"
                onClick={() => {
                  const blob = new Blob([text], { type: "text/plain" });
                  window.open(URL.createObjectURL(blob), "_blank");
                }}
              >
                <FileText className="size-[15px] text-fg-muted" />
              </Button>
              <CopyButton value={text} label="Copy pin" />
            </>
          )}
          {editToken &&
            (editing ? (
              <>
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => {
                  setDraft(text);
                  setEditing(true);
                }}
              >
                Edit
              </Button>
            ))}
        </>
      }
    >
      {error && (
        <p role="alert" className="text-xs text-accent">
          {error}
        </p>
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-surface">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span className="truncate font-mono text-xs">{pin.id}</span>
            <span className="shrink-0 text-xs text-fg-faint">{relativeTime(pin.created_at)}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {passphrase && (
              <span className="flex items-center gap-1.5 rounded bg-success/10 px-2 py-1 text-[11px] font-medium text-success">
                <LockKeyhole className="size-3" />
                Decrypted locally
              </span>
            )}
            <span className="hidden font-mono text-[11px] text-fg-faint sm:inline">
              {pin.language}
            </span>
          </div>
        </div>

        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            aria-label="Edit pin content"
            className="min-h-0 flex-1 resize-none bg-transparent p-3.5 font-mono text-[13px]/[1.55] outline-none"
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <CodeBlock code={text} language={pin.language} />
          </div>
        )}
      </div>
    </Shell>
  );
}

function Unlock({ pin, onOpen }: { pin: Pin; onOpen: (text: string, passphrase: string) => void }) {
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onOpen(await decrypt(pin.ciphertext!, pin.iv!, passphrase), passphrase);
    } catch (err) {
      setError(
        err instanceof WrongPassphraseError
          ? "Wrong passphrase."
          : "Could not decrypt this pin.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell actions={<span className="text-xs text-fg-faint">passphrase required</span>}>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-lg border border-line bg-surface p-5">
        <form onSubmit={submit} className="flex w-full max-w-[420px] flex-col items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-full border border-line bg-surface-2">
            <LockKeyhole className="size-5 text-warn" />
          </span>
          <h1 className="text-[17px] font-semibold">This pin is encrypted</h1>
          <p className="text-center text-[13px]/[1.55] text-fg-muted">
            Enter the passphrase to decrypt it in your browser. The server only ever stored
            ciphertext — it cannot unlock this for you.
          </p>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="passphrase"
            aria-label="Passphrase"
            autoFocus
            className="w-full rounded-md border border-line bg-bg px-3 py-2.5 font-mono text-[13px] outline-none placeholder:text-fg-faint focus:border-accent"
          />
          {error && (
            <p role="alert" className="text-xs text-accent">
              {error}
            </p>
          )}
          <Button type="submit" className="h-10 w-full" disabled={busy || passphrase === ""}>
            {busy ? "Decrypting…" : "Unlock"}
          </Button>
        </form>
      </div>
    </Shell>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <Shell>
      <div className="flex flex-1 items-center justify-center text-sm text-fg-muted">{children}</div>
    </Shell>
  );
}

function relativeTime(iso: string) {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 30],
    ["month", 12],
    ["year", Infinity],
  ];

  let value = seconds;
  for (const [unit, step] of units) {
    if (Math.abs(value) < step) {
      return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-value, unit);
    }
    value = Math.round(value / step);
  }
  return iso;
}

export { relativeTime };
