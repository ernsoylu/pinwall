import { Plus, QrCode } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/Button";
import { CopyButton } from "../components/CopyButton";
import { QrPanel } from "../components/QrPanel";
import { dateStamp } from "../lib/time";

type Props = {
  id: string;
  editToken: string;
  isPrivate: boolean;
  language: string;
  onClose: () => void;
};

/**
 * The cloakroom ticket. The half above the perforation is handed over; the half
 * below it is the stub you keep, and it is the only copy of the edit token.
 */
export function ShareModal({ id, editToken, isPrivate, language, onClose }: Props) {
  const [showQr, setShowQr] = useState(true);
  const shareUrl = `${location.origin}/${id}`;
  const editUrl = `${shareUrl}#${editToken}`;
  const renderedUrl = `${shareUrl}?view=rendered`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-[#12171acc] p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-title"
    >
      <div className="plate stock flex w-full max-w-[460px] flex-col rounded-t-[6px] sm:my-auto sm:rounded-[4px]">
        {/* ─── the half you hand over ─── */}
        <div className="flex flex-col gap-4 px-5 pb-5 pt-4 sm:px-6">
          <div className="mx-auto h-1 w-9 shrink-0 rounded-full bg-ticket-rule sm:hidden" />

          <div className="mb-1.5 flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2
                id="share-title"
                className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.035em] text-ink"
              >
                Tag issued
              </h2>
              <p className="tabular flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-ink-faint">
                <span className="rounded-[2px] bg-brass px-1.5 py-0.5 font-semibold text-enamel-deep">
                  {id}
                </span>
                <span className="uppercase tracking-[0.1em]">
                  {dateStamp()} · {language}
                </span>
              </p>
            </div>
            <span
              className={`stamp mt-0.5 shrink-0 rounded-[2px] border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ${
                isPrivate
                  ? "border-oxblood text-oxblood"
                  : "border-ink-faint text-ink-faint"
              }`}
            >
              {isPrivate ? "Sealed" : "Open"}
            </span>
          </div>

          <Field label="Hand this over" url={shareUrl}>
            <CopyButton value={shareUrl} label="Copy share link" />
            <Button
              variant="stock"
              size="icon"
              aria-label="Toggle QR code"
              aria-pressed={showQr}
              onClick={() => setShowQr((v) => !v)}
            >
              <QrCode className="size-[15px]" />
            </Button>
          </Field>

          {showQr && <QrPanel url={shareUrl} />}

          {language === "markdown" && (
            <Field label="Rendered link" url={renderedUrl}>
              <CopyButton value={renderedUrl} label="Copy rendered link" />
            </Field>
          )}

          {/* What the counter actually holds — the claim, stated as a fact to check. */}
          <p className="text-[12.5px]/[1.6] text-ink-muted">
            {isPrivate ? (
              <>
                The counter received <Mono>ciphertext</Mono> and <Mono>iv</Mono>, nothing else —
                it never saw your text or your passphrase. Both stayed in this browser, so nobody
                here can unlock this, including us.
              </>
            ) : (
              <>
                This is an open deposit: the counter received your text as written, and anyone with
                the tag can read it. Seal a deposit to encrypt it before it is sent.
              </>
            )}
          </p>
        </div>

        <div className="perforation shrink-0" />

        {/* ─── the half you keep ─── */}
        <div className="ruled flex flex-col gap-3 bg-ticket-hi px-5 pb-6 pt-5 sm:px-6">
          <Field label="Keep this — your stub" url={editUrl} tone="warn">
            <CopyButton value={editUrl} label="Copy edit link" />
          </Field>
          <p className="text-[12px]/[1.55] text-oxblood">
            Save it now. The token lives in the URL fragment, which browsers never send to a server,
            so the counter cannot give you another copy. Lose the stub and this deposit can never be
            edited again.
          </p>

          <div className="mt-1 flex gap-2.5">
            <Button variant="stock" className="h-10 flex-1" onClick={onClose}>
              <Plus className="size-3.5" />
              New deposit
            </Button>
            <Button className="h-10 flex-1" onClick={() => (location.href = shareUrl)}>
              Open pin
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-[2px] border border-ticket-rule bg-ticket-hi px-1 py-px font-mono text-[0.85em] text-ink">
      {children}
    </code>
  );
}

function Field({
  label,
  url,
  tone = "plain",
  children,
}: {
  label: string;
  url: string;
  tone?: "plain" | "warn";
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className={`font-mono text-[10px] font-semibold uppercase tracking-[0.13em] ${
          tone === "warn" ? "text-oxblood" : "text-ink-faint"
        }`}
      >
        {label}
      </span>
      <div
        className={`flex items-center justify-between gap-2 overflow-hidden rounded-[3px] border bg-ticket-hi py-1.5 pl-3 pr-1.5 ${
          tone === "warn" ? "border-oxblood/45" : "border-ticket-rule"
        }`}
      >
        <span className="truncate font-mono text-[12.5px] text-ink">{url}</span>
        <span className="flex shrink-0 items-center gap-1.5">{children}</span>
      </div>
    </div>
  );
}
