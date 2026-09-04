import qr from "qrcode-generator";

export function QrPanel({ url }: { url: string }) {
  const code = qr(0, "M");
  code.addData(url);
  code.make();

  const count = code.getModuleCount();
  const cells: string[] = [];
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (code.isDark(r, c)) cells.push(`M${c} ${r}h1v1h-1z`);
    }
  }

  return (
    <div className="flex items-center gap-3.5 rounded-lg border border-line bg-bg p-3.5">
      <div className="flex size-[124px] shrink-0 items-center justify-center rounded-md bg-white">
        <svg viewBox={`0 0 ${count} ${count}`} className="size-[104px]" aria-label="QR code">
          <path d={cells.join("")} fill="#0b0c0e" />
        </svg>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Scan to open</p>
        <p className="text-xs/[1.5] text-fg-muted">
          Point a phone camera here to open the pin on another device. The passphrase is not in the
          code.
        </p>
      </div>
    </div>
  );
}
