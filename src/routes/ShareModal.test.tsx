import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ShareModal } from "./ShareModal";

const props = {
  id: "abc1234",
  editToken: "tok-123",
  isPrivate: true,
  language: "typescript",
  onClose: vi.fn(),
};

describe("ShareModal", () => {
  it("puts the edit token in the fragment only, never the share link", () => {
    render(<ShareModal {...props} />);

    const share = screen.getByText(`${location.origin}/abc1234`);
    const edit = screen.getByText(`${location.origin}/abc1234#tok-123`);

    expect(share.textContent).not.toContain("tok-123");
    expect(edit.textContent).toContain("#tok-123");
  });

  it("warns that the edit token cannot be recovered", () => {
    render(<ShareModal {...props} />);
    expect(screen.getByText(/cannot give you another copy/i)).toBeInTheDocument();
  });

  it("encodes the share link, not the edit link, into the QR code", async () => {
    render(<ShareModal {...props} />);
    expect(screen.getByLabelText("QR code for the share link")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Toggle QR code" }));
    expect(screen.queryByLabelText("QR code for the share link")).not.toBeInTheDocument();
  });

  it("copies the share link to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<ShareModal {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Copy share link" }));

    expect(writeText).toHaveBeenCalledWith(`${location.origin}/abc1234`);
  });

  it("describes a public pin differently from a private one", () => {
    const { unmount } = render(<ShareModal {...props} isPrivate={false} />);
    expect(screen.getByText(/anyone with\s+the tag can read it/i)).toBeInTheDocument();
    unmount();

    render(<ShareModal {...props} isPrivate />);
    expect(screen.getByText(/never saw your text/i)).toBeInTheDocument();
  });
  it("offers a rendered link for markdown pins only", () => {
    const { unmount } = render(<ShareModal {...props} />);
    expect(screen.queryByText(/\?view=rendered/)).not.toBeInTheDocument();
    unmount();

    render(<ShareModal {...props} language="markdown" />);
    expect(screen.getByText(`${location.origin}/abc1234?view=rendered`)).toBeInTheDocument();
  });
});
