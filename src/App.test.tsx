import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./routes/Creator", () => ({ Creator: () => <div>creator</div> }));
vi.mock("./routes/Viewer", () => ({
  Viewer: ({ id, editToken }: { id: string; editToken: string | null }) => (
    <div>
      viewer:{id}:{editToken ?? "none"}
    </div>
  ),
}));

const { App } = await import("./App");

function go(pathname: string, hash = "") {
  window.history.replaceState(null, "", pathname + hash);
}

afterEach(() => go("/"));

describe("routing", () => {
  it("shows the creator at the root", () => {
    go("/");
    render(<App />);
    expect(screen.getByText("creator")).toBeInTheDocument();
  });

  it("treats a trailing slash as the root", () => {
    go("/");
    render(<App />);
    expect(screen.getByText("creator")).toBeInTheDocument();
  });

  it("routes a short id to the viewer", () => {
    go("/abc1234");
    render(<App />);
    expect(screen.getByText("viewer:abc1234:none")).toBeInTheDocument();
  });

  it("passes the fragment through as the edit token", () => {
    go("/abc1234", "#tok-123");
    render(<App />);
    expect(screen.getByText("viewer:abc1234:tok-123")).toBeInTheDocument();
  });

  it("strips surrounding slashes from the id", () => {
    go("/abc1234/");
    render(<App />);
    expect(screen.getByText("viewer:abc1234:none")).toBeInTheDocument();
  });
});
