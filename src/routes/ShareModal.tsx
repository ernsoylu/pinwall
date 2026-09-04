import { CircleCheckBig, Plus, QrCode } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/Button";
import { CopyButton } from "../components/CopyButton";
import { QrPanel } from "../components/QrPanel";

type Props = {
  id: string;
  editToken: string;
  isPrivate: boolean;
  language: string;
  onClose: () => void;
};

export function ShareModal({ id, editToken, isPrivate, language, onClose }: Props) {
  const [showQr, setShowQr] = useState(true);
  const shareUrl = `${location.origin}/${id}`;
  const editUrl = `${shareUrl}#${editToken}`;
  const renderedUrl = `${shareUrl}?view=rendered`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#050608b8] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-title"
    >
      <div className="flex w-full max-w-[480px] flex-col gap-4 rounded-t-2xl border border-line bg-surface px-4 pb-8 pt-2.5 shadow-2xl sm:gap-5 sm:rounded-xl sm:p-6">
        <div className="mx-auto h-1 w-9 rounded-full bg-[#3a414b] sm:hidden" />

        <div className="flex flex-col gap-1.5">
          <h2 id="share-title" className="flex items-center gap-2 text-[17px] font-semibold">
            <CircleCheckBig className="size-[18px] text-success" />
            Pin created
          </h2>
          <p className="text-[13px]/[1.5] text-fg-muted">
            {isPrivate
              ? "Private pin — encrypted in your browser with AES-GCM. The server never saw your text."
              : "Public pin. Anyone with the link can read it."}
          </p>
        </div>

        <Field label="SHARE LINK" url={shareUrl}>
          <CopyButton value={shareUrl} label="Copy share link" />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle QR code"
            aria-pressed={showQr}
            onClick={() => setShowQr((v) => !v)}
          >
            <QrCode className="size-[15px] text-fg-muted" />
          </Button>
        </Field>

        {showQr && <QrPanel url={shareUrl} />}

        {language === "markdown" && (
          <Field label="RENDERED LINK" url={renderedUrl}>
            <CopyButton value={renderedUrl} label="Copy rendered link" />
          </Field>
        )}

        <div className="flex flex-col gap-2">
          <Field label="EDIT LINK" url={editUrl}>
            <CopyButton value={editUrl} label="Copy edit link" />
          </Field>
          <p className="text-xs/[1.45] text-warn">
            Save this now. The token lives only in the URL fragment — it is never sent to the server,
            and cannot be recovered.
          </p>
        </div>

        <div className="flex gap-2.5">
          <Button variant="ghost" className="h-10 flex-1" onClick={onClose}>
            <Plus className="size-3.5" />
            New pin
          </Button>
          <Button className="h-10 flex-1" onClick={() => (location.href = shareUrl)}>
            Open pin
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  url,
  children,
}: {
  label: string;
  url: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold tracking-wider text-fg-faint">{label}</span>
      <div className="flex items-center justify-between gap-2 overflow-hidden rounded-md border border-line bg-bg py-1.5 pl-3 pr-1.5">
        <span className="truncate font-mono text-[13px]">{url}</span>
        <span className="flex shrink-0 items-center gap-1.5">{children}</span>
      </div>
    </div>
  );
}
