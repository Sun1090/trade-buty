// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FocusMode } from "./focus-mode";

let header: HTMLElement | null = null;

function mountHeader() {
  header = document.createElement("header");
  document.body.appendChild(header);
}

afterEach(() => {
  header?.remove();
  header = null;
});

describe("FocusMode", () => {
  it("starts inactive with the normal label", () => {
    mountHeader();
    render(<FocusMode label="专注模式" activeLabel="退出专注" />);
    const button = screen.getByRole("button", { name: "专注模式" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(header?.style.display).toBe("");
  });

  it("hides the site header while active and restores it on toggle", () => {
    mountHeader();
    render(<FocusMode label="专注模式" activeLabel="退出专注" />);
    const button = screen.getByRole("button", { name: "专注模式" });

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "退出专注" })).toBeInTheDocument();
    expect(header?.style.display).toBe("none");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(header?.style.display).toBe("");
  });

  it("restores the header when unmounted while active", () => {
    mountHeader();
    const { unmount } = render(
      <FocusMode label="专注模式" activeLabel="退出专注" />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(header?.style.display).toBe("none");
    unmount();
    expect(header?.style.display).toBe("");
  });

  it("degrades gracefully when no header exists", () => {
    render(<FocusMode label="专注模式" activeLabel="退出专注" />);
    expect(() => fireEvent.click(screen.getByRole("button"))).not.toThrow();
  });
});
