import { useEffect, useRef } from "react";

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
  /** Bump to discard a spent token and render a fresh challenge. */
  resetKey?: number;
};

export function Turnstile({ onToken, resetKey = 0 }: Props) {
  const host = useRef<HTMLDivElement>(null);
  // Keep the latest callback without re-rendering the widget on every parent render.
  const cb = useRef(onToken);
  useEffect(() => {
    cb.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let widgetId: string | undefined;
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !host.current || !window.turnstile) return;
        widgetId = window.turnstile.render(host.current, {
          sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
          theme: "dark",
          callback: (token: string) => cb.current(token),
          "expired-callback": () => cb.current(null),
          "error-callback": () => cb.current(null),
        });
      })
      .catch(() => cb.current(null));

    return () => {
      cancelled = true;
      cb.current(null);
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [resetKey]);

  return <div ref={host} data-testid="turnstile" />;
}
