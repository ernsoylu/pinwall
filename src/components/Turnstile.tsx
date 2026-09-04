import { ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptLoad: Promise<void> | null = null;

function loadScript() {
  if (window.turnstile) return Promise.resolve();
  if (!scriptLoad) {
    scriptLoad = new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = SRC;
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error("turnstile_script_failed"));
      document.head.appendChild(el);
    });
  }
  return scriptLoad;
}

type Props = {
  onToken: (token: string | null) => void;
  /** Cloudflare's client-side error code, e.g. "400020" (invalid sitekey). */
  onError?: (code: string) => void;
  /** Bump to discard a spent token and render a fresh challenge. */
  resetKey?: number;
};

export function Turnstile({ onToken, onError, resetKey = 0 }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [challenging, setChallenging] = useState(false);
  // Tracked against resetKey so a fresh widget is unsolved without an effect
  // writing state during render.
  const [solvedFor, setSolvedFor] = useState<number | null>(null);
  const solved = solvedFor === resetKey;
  // Keep the latest callbacks without re-rendering the widget on every parent render.
  const cb = useRef({ onToken, onError });
  useEffect(() => {
    cb.current = { onToken, onError };
  });

  useEffect(() => {
    let widgetId: string | undefined;
    let cancelled = false;

    // Cloudflare only reports the failure inside its own widget, so surface the
    // code — without it a bad sitekey looks like a permanently disabled button.
    const fail = (code: string) => {
      setChallenging(false);
      setSolvedFor(null);
      cb.current.onToken(null);
      cb.current.onError?.(code);
    };

    const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    if (!sitekey) {
      fail("missing_sitekey");
      return;
    }

    loadScript()
      .then(() => {
        if (cancelled || !host.current || !window.turnstile) return;
        widgetId = window.turnstile.render(host.current, {
          sitekey,
          theme: "dark",
          // Keep Cloudflare's branded box out of the layout unless the visitor
          // actually has to act. resetKey tears the widget down and renders a
          // new one rather than calling reset(), which is what keeps
          // interaction-only working on a retry:
          // https://community.cloudflare.com/t/579897
          appearance: "interaction-only",
          // The only cue that Cloudflare is about to put a visible box on the
          // page. Without it there is no way to frame the widget as ours.
          "before-interactive-callback": () => setChallenging(true),
          callback: (token: string) => {
            setChallenging(false);
            setSolvedFor(resetKey);
            cb.current.onToken(token);
          },
          "expired-callback": () => {
            setSolvedFor(null);
            cb.current.onToken(null);
          },
          "error-callback": (code: string) => fail(code),
        });
      })
      .catch(() => fail("script_failed"));

    return () => {
      cancelled = true;
      cb.current.onToken(null);
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [resetKey]);

  // The host element never moves — only the framing around it changes — because
  // relocating it in the tree would tear Cloudflare's widget out of the DOM.
  return (
    <div
      className={
        challenging
          ? "flex w-full items-center gap-2.5 rounded-[3px] border border-brass/50 bg-enamel px-3 py-2"
          : "flex items-center gap-2"
      }
    >
      <ShieldAlert className={challenging ? "size-4 shrink-0 text-brass-lit" : "hidden"} />
      <span
        aria-live="polite"
        className={
          challenging
            ? "text-[13px] text-ink"
            : "font-mono text-[10px] uppercase tracking-[0.11em] text-on-enamel"
        }
      >
        {challenging ? "One quick check first" : solved ? "verified" : "verifying…"}
      </span>
      <div ref={host} data-testid="turnstile" />
    </div>
  );
}
