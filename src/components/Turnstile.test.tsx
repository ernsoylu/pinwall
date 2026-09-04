import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Turnstile } from "./Turnstile";

type Opts = Record<string, (arg?: string) => void>;
let opts: Opts | undefined;

beforeEach(() => {
  opts = undefined;
  window.turnstile = {
    render: (_el, o) => {
      opts = o as unknown as Opts;
      return "w1";
    },
    remove: () => {},
    reset: () => {},
  };
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete window.turnstile;
});

describe("Turnstile", () => {
  it("passes Cloudflare's error code up instead of failing silently", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "0xTEST");
    const onToken = vi.fn();
    const onError = vi.fn();
    render(<Turnstile onToken={onToken} onError={onError} />);

    await waitFor(() => expect(opts).toBeDefined());
    opts!["error-callback"]("400020");

    expect(onError).toHaveBeenCalledWith("400020");
    expect(onToken).toHaveBeenLastCalledWith(null);
  });

  it("reports a build with no site key", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    const onError = vi.fn();
    render(<Turnstile onToken={vi.fn()} onError={onError} />);

    await waitFor(() => expect(onError).toHaveBeenCalledWith("missing_sitekey"));
    expect(opts).toBeUndefined();
  });

  it("hands a solved token to the parent", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "0xTEST");
    const onToken = vi.fn();
    render(<Turnstile onToken={onToken} />);

    await waitFor(() => expect(opts).toBeDefined());
    opts!.callback("tok-1");

    expect(onToken).toHaveBeenCalledWith("tok-1");
  });
  it("frames Cloudflare's challenge in app chrome only while one is required", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "0xTEST");
    render(<Turnstile onToken={vi.fn()} />);
    await waitFor(() => expect(opts).toBeDefined());

    expect(screen.getByText("verifying…")).toBeInTheDocument();

    act(() => opts!["before-interactive-callback"]());
    expect(screen.getByText("One quick check first")).toBeInTheDocument();

    act(() => opts!.callback("tok-1"));
    expect(screen.queryByText("One quick check first")).not.toBeInTheDocument();
    expect(screen.getByText("verified")).toBeInTheDocument();
  });
});
