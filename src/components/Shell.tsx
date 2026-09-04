import { Pin } from "lucide-react";
import type { ReactNode } from "react";

export function Shell({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4 sm:px-6">
        <a href="/" className="flex items-center gap-2">
          <Pin className="size-[17px] text-accent" />
          <span className="font-mono text-[15px] font-semibold tracking-tight">pinwall</span>
        </a>
        <div className="flex items-center gap-2">{actions}</div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col gap-3 p-4 sm:gap-3.5 sm:p-6">{children}</main>
    </div>
  );
}
