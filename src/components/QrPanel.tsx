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
    <div className="flex items-center gap-4 rounded-[3px] border border-ticket-rule bg-ticket-hi p-3.5">
      {/*
       * The code keeps its own light field with a real quiet zone: scanners
       * expect dark modules on light, and an inverted code is a code some
       * phones will not read.
       */}
      <svg
        viewBox={`-2 -2 ${count + 4} ${count + 4}`}
        className="size-[104px] shrink-0 rounded-[2px]"
        aria-label="QR code for the share link"
      >
        <rect x={-2} y={-2} width={count + 4} height={count + 4} fill="var(--color-ink)" />
        <path d={cells.join("")} fill="var(--color-enamel-deep)" />
      </svg>
      <div className="flex flex-col gap-1.5">
        <p className="text-[13px] font-semibold text-ink">Scan to open elsewhere</p>
        <p className="text-[12px]/[1.55] text-ink-muted">
          Point a phone camera here to open the pin on another device. The passphrase is not in the
          code.
        </p>
      </div>
    </div>
  );
}
