import type { ReactNode } from "react";

/**
 * The counter. An enamel front with the wordmark on its plate and the posted
 * notice at the right, over the deep recess the deposit plate sits in.
 */
export function Shell({ actions, notice, children }: { actions?: ReactNode; notice?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col bg-enamel-deep">
      <header className="flex shrink-0 items-center justify-between gap-3 enamel-gloss border-b border-enamel-lit bg-enamel px-3 py-3 sm:px-5">
        <a href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="pinwall, new deposit">
          <Tag />
          <span className="font-mono text-[16px] font-semibold leading-none tracking-[-0.03em] text-ink">
            pinwall
          </span>
        </a>
        {notice && (
          <p className="hidden min-w-0 flex-1 text-right text-[12px]/[1.45] text-on-enamel md:block">
            {notice}
          </p>
        )}
        <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-5">
        {children}
        {notice && (
          <p className="shrink-0 text-[12px]/[1.45] text-on-enamel md:hidden">{notice}</p>
        )}
      </main>
    </div>
  );
}

/** The brass tag on its hook — the mark a deposit gets in exchange for the bag. */
function Tag() {
  return (
    <svg width="19" height="24" viewBox="0 0 19 24" aria-hidden className="shrink-0 overflow-visible">
      <path
        d="M9.5 1v4.4"
        stroke="var(--color-brass)"
        strokeWidth="1.4"
        strokeLinecap="round"
        className="origin-[9.5px_1px] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-[7deg]"
      />
      <g className="origin-[9.5px_2px] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-[7deg]">
        <rect
          x="2.5"
          y="5.4"
          width="14"
          height="17"
          rx="2.5"
          fill="var(--color-brass)"
          stroke="var(--color-brass-lit)"
          strokeWidth="1"
        />
        <circle cx="9.5" cy="9.4" r="1.6" fill="var(--color-enamel-deep)" />
        <path
          d="M6 14h7M6 17.4h4.5"
          stroke="var(--color-enamel-deep)"
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.75"
        />
      </g>
    </svg>
  );
}

/**
 * The four-field label grid. Every object in the product carries it in the
 * same order — the deposit plate, the viewer, and the stub — so a visitor
 * reads the same row wherever they meet a pin.
 */
export function LabelGrid({
  tag,
  deposited,
  keepUntil,
  seal,
}: {
  tag: ReactNode;
  deposited: ReactNode;
  keepUntil: ReactNode;
  seal: ReactNode;
}) {
  return (
    <dl className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-2 sm:gap-x-7">
      <Field label="Tag">{tag}</Field>
      <Field label="Deposited">{deposited}</Field>
      <Field label="Keep until">{keepUntil}</Field>
      <Field label="Seal">{seal}</Field>
    </dl>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex min-w-0 shrink-0 flex-col gap-0.5 ${className}`}>
      <dt className="font-mono text-[9px] uppercase leading-none tracking-[0.14em] text-ink-faint">
        {label}
      </dt>
      <dd className="tabular truncate font-mono text-[11.5px] font-medium leading-none text-ink-muted">
        {children}
      </dd>
    </div>
  );
}
