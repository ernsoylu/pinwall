import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./Button";

export function CopyButton({
  value,
  label = "Copy",
  variant = "stock",
}: {
  value: string;
  label?: string;
  variant?: "stock" | "ghost";
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <Button
      variant={variant}
      size="icon"
      aria-label={label}
      title={label}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
      }}
    >
      {copied ? (
        <Check className="size-[15px] text-brass" />
      ) : (
        <Copy className="size-[15px]" />
      )}
    </Button>
  );
}
