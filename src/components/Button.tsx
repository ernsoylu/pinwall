import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-[3px] font-semibold transition-[background-color,color,border-color,box-shadow] duration-150 disabled:pointer-events-none disabled:border disabled:border-dashed disabled:border-brass/55 disabled:bg-transparent disabled:text-ink-muted disabled:shadow-none",
  {
    variants: {
      variant: {
        /* Brass: the counter's one action. Ink on brass, never brass on stock. */
        primary:
          "bg-brass text-enamel-deep shadow-[0_1px_0_var(--color-brass-lit)_inset,0_6px_16px_-8px_rgb(0_0_0/0.55)] hover:bg-brass-lit",
        /* Enamel: everything that acts on the counter without being the action. */
        ghost:
          "border border-enamel-lit bg-enamel text-ink hover:border-brass hover:bg-enamel-lit",
        /* Stock: actions that live on the plate itself. */
        stock:
          "border border-ticket-rule bg-ticket-hi text-ink-muted hover:border-brass hover:text-ink",
      },
      size: {
        md: "px-3.5 py-2 text-[13px]",
        icon: "size-[32px] shrink-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Props = ComponentProps<"button"> & VariantProps<typeof button>;

export function Button({ className, variant, size, ...props }: Props) {
  return <button className={cn(button({ variant, size }), className)} {...props} />;
}
