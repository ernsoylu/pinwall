import { Code2, Eye, FileText, Lock, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { CodeBlock } from "../components/CodeBlock";
import { CodeEditor } from "../components/CodeEditor";
import { Markdown } from "../components/Markdown";
import { CopyButton } from "../components/CopyButton";
import { LabelGrid, Shell } from "../components/Shell";
import { getPin, updatePin, type Pin } from "../lib/api";
import { dateStamp, relativeTime } from "../lib/time";
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

  if (state.status === "loading")
    return (
      <Counter>
        <p className="font-mono text-[12px] uppercase tracking-[0.11em] text-ink-faint">
          Fetching tag {id}…
        </p>
      </Counter>
    );

  if (state.status === "missing")
    return (
      <Counter
        title="No deposit under this tag"
        body={
          <>
            Nothing is held against <Tag>{id}</Tag>. The tag may be mistyped, or the deposit was
            never made.
          </>
        }
      />
    );

  if (state.status === "error")
    return (
      <Counter
        title="The counter did not answer"
        body="The pin could not be fetched. It may be a network problem at your end or ours."
        retry
      />
    );

  if (state.status === "locked")
    return (
      <Unlock
        pin={state.pin}
        onOpen={(text, passphrase) =>
          setState({ status: "ready", pin: state.pin, text, passphrase })
        }
      />
    );

  return (
    <Ready state={state} editToken={editToken} onText={(text) => setState({ ...state, text })} />
  );
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
  const isMarkdown = pin.language === "markdown";
  const [editing, setEditing] = useState(false);
  const [rendered, setRendered] = useState(
    () => isMarkdown && new URLSearchParams(location.search).get("view") === "rendered",
  );
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

  // Keep the address bar in step so the toggle produces a link worth copying.
  useEffect(() => {
    if (!isMarkdown) return;
    const url = new URL(location.href);
    if (rendered) url.searchParams.set("view", "rendered");
    else url.searchParams.delete("view");
    history.replaceState(null, "", url);
  }, [isMarkdown, rendered]);

  return (
    <Shell
      notice={
        passphrase
          ? "Unsealed in this browser. The counter only ever held ciphertext — it has no key for this."
          : "An open deposit: this was stored as written, and anyone with the tag can read it."
      }
      actions={
        <>
          {!editing && (
            <>
              {isMarkdown && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={rendered ? "Show markdown source" : "Render markdown"}
                  title={rendered ? "Source" : "Rendered"}
                  aria-pressed={rendered}
                  onClick={() => setRendered((v) => !v)}
                >
                  {rendered ? <Code2 className="size-[15px]" /> : <Eye className="size-[15px]" />}
                </Button>
              )}
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
                <FileText className="size-[15px]" />
              </Button>
              <CopyButton value={text} label="Copy pin" variant="ghost" />
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
                Amend
              </Button>
            ))}
        </>
      }
    >
      {error && (
        <p
          role="alert"
          className="rounded-[3px] border border-oxblood bg-oxblood/15 px-3 py-2 text-[12.5px] text-ink"
        >
          {error}
        </p>
      )}
      <div className="plate flex min-h-0 flex-1 flex-col overflow-hidden rounded-[3px]">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-ticket-rule px-4 py-2.5">
          <LabelGrid
            tag={
              <span className="rounded-[2px] bg-brass px-1.5 py-0.5 font-semibold text-enamel-deep">
                {pin.id}
              </span>
            }
            deposited={dateStamp(pin.created_at)}
            keepUntil="no limit"
            seal={
              passphrase ? (
                <span className="text-oxblood">unsealed here</span>
              ) : (
                <span className="text-ink-faint">open</span>
              )
            }
          />
          <span className="shrink-0 truncate font-mono text-[11px] text-ink-faint">
            {relativeTime(pin.created_at)}
          </span>
        </div>

        {editing ? (
          <CodeEditor
            value={draft}
            onChange={setDraft}
            language={pin.language}
            label="Edit pin content"
          />
        ) : (
          <div className={`min-h-0 flex-1 overflow-auto ${rendered ? "stock" : "recess"}`}>
            {rendered ? (
              <Markdown source={text} />
            ) : (
              <CodeBlock code={text} language={pin.language} />
            )}
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
        err instanceof WrongPassphraseError ? "Wrong passphrase." : "Could not decrypt this pin.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell notice="The counter holds this deposit sealed — it has no key for it">
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto py-6">
        <form
          onSubmit={submit}
          className="plate flex w-full max-w-[440px] flex-col gap-4 rounded-[3px] px-6 py-7"
        >
          <div className="flex items-center gap-3">
            <span className="stamp flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-oxblood">
              <Lock className="size-[18px] text-oxblood" aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <h1 className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.035em] text-ink">
                This deposit is sealed
              </h1>
              <p className="tabular font-mono text-[11px] text-ink-faint">
                <span className="uppercase tracking-[0.1em]">Tag</span>{" "}
                <span className="font-semibold text-ink">{pin.id}</span>
                <span className="uppercase tracking-[0.1em]"> · {dateStamp(pin.created_at)}</span>
              </p>
            </div>
          </div>

          <p className="text-[13px]/[1.6] text-ink-muted">
            Enter the passphrase to decrypt it in your browser. The counter only ever stored
            ciphertext — it cannot unlock this for you.
          </p>

          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="passphrase"
            aria-label="Passphrase"
            autoComplete="off"
            autoFocus
            className="w-full rounded-[3px] border border-ticket-rule bg-ticket-hi px-3 py-2.5 font-mono text-[13px] text-ink caret-oxblood outline-none placeholder:text-ink-faint focus:border-oxblood"
          />
          {error && (
            <p role="alert" className="text-[12.5px] font-semibold text-oxblood">
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

/**
 * The counter's answer when there is nothing to show. Every one of these used
 * to be a bare sentence that ended the session; each now names what happened
 * and offers the one action that helps.
 */
function Counter({
  title,
  body,
  retry,
  children,
}: {
  title?: string;
  body?: React.ReactNode;
  retry?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Shell>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto py-6">
        <div className="plate flex w-full max-w-[440px] flex-col items-center rounded-[3px] px-6 py-8 text-center">
          {children ?? (
            <div className="flex flex-col items-center gap-3">
              <h1 className="text-[26px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink">
                {title}
              </h1>
              <p className="text-[13px]/[1.6] text-ink-muted">{body}</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
                {retry && (
                  <Button variant="stock" onClick={() => location.reload()}>
                    Try again
                  </Button>
                )}
                <Button onClick={() => (location.href = "/")}>
                  <Plus className="size-3.5" />
                  New deposit
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-[2px] border border-ticket-rule bg-ticket-hi px-1 py-px font-mono text-[0.9em] text-ink">
      {children}
    </code>
  );
}
