// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getTheme: vi.fn<() => "dark" | "light" | "sepia">(() => "dark"),
  setTheme: vi.fn(),
}));

vi.mock("@/lib/theme", () => ({
  getTheme: mocks.getTheme,
  setTheme: mocks.setTheme,
}));

import { ThemeSelector } from "./theme-selector";

const labels = { dark: "深色", light: "浅色", sepia: "护眼" };

beforeEach(() => {
  mocks.getTheme.mockClear();
  mocks.setTheme.mockClear();
  mocks.getTheme.mockReturnValue("dark");
});

describe("ThemeSelector", () => {
  it("renders one labelled button per theme mode", () => {
    render(<ThemeSelector labels={labels} />);
    expect(screen.getByRole("button", { name: "深色" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "浅色" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "护眼" })).toBeInTheDocument();
  });

  it("applies setTheme with the clicked mode", () => {
    render(<ThemeSelector labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: "护眼" }));
    expect(mocks.setTheme).toHaveBeenCalledWith("sepia");
  });

  it("highlights the active mode", () => {
    mocks.getTheme.mockReturnValue("light");
    render(<ThemeSelector labels={labels} />);
    expect(screen.getByRole("button", { name: "浅色" }).className).toContain(
      "text-accent",
    );
    expect(screen.getByRole("button", { name: "深色" }).className).toContain(
      "text-faint",
    );
  });

  it("does not emit a button without a type-safe handler", () => {
    render(<ThemeSelector labels={labels} />);
    for (const button of screen.getAllByRole("button")) {
      fireEvent.click(button);
    }
    expect(mocks.setTheme).toHaveBeenCalledTimes(3);
  });
});
