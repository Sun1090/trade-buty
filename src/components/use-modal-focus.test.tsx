// @vitest-environment jsdom
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useModalFocus } from "./use-modal-focus";

function Harness({ empty = false }: { empty?: boolean }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useModalFocus({
    active: open,
    containerRef: panelRef,
    onClose: () => setOpen(false),
  });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {open && (
        <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Test dialog" tabIndex={-1}>
          {!empty && (
            <>
              <button type="button">First</button>
              <button type="button">Last</button>
            </>
          )}
        </div>
      )}
    </>
  );
}

describe("useModalFocus", () => {
  it("moves focus into the dialog, closes on Escape, and restores focus", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open" });
    trigger.focus();
    fireEvent.click(trigger);

    await waitFor(() => expect(screen.getByRole("button", { name: "First" })).toHaveFocus());
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("cycles Tab and Shift+Tab within the dialog", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    const first = screen.getByRole("button", { name: "First" });
    const last = screen.getByRole("button", { name: "Last" });
    await waitFor(() => expect(first).toHaveFocus());

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });

  it("focuses the dialog itself when there are no focusable children", async () => {
    render(<Harness empty />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    await waitFor(() => expect(screen.getByRole("dialog")).toHaveFocus());
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("dialog")).toHaveFocus();
  });
});
