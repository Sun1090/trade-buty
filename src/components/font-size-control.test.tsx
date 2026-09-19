// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FontSizeControl } from "./font-size-control";

const labels = {
  smaller: "缩小",
  larger: "放大",
  lineHeightIncrease: "增大行距",
  lineHeightDecrease: "减小行距",
};

const root = document.documentElement;

function button(name: string) {
  return screen.getByRole("button", { name });
}

describe("FontSizeControl", () => {
  beforeEach(() => {
    localStorage.clear();
    root.style.removeProperty("--kb-scale");
    root.style.removeProperty("--kb-line-height");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    root.style.removeProperty("--kb-scale");
    root.style.removeProperty("--kb-line-height");
  });

  it("renders accessible controls with default bounds available", () => {
    render(<FontSizeControl labels={labels} />);

    expect(button("缩小: A-")).toBeEnabled();
    expect(button("放大: A+")).toBeEnabled();
    expect(button("增大行距: ☰+")).toBeEnabled();
    expect(button("减小行距: ☰-")).toBeEnabled();
  });

  it("loads valid persisted preferences and reflects their bounds", async () => {
    localStorage.setItem("tb-font-scale", "1.2");
    localStorage.setItem("tb-line-height", "1.5");

    render(<FontSizeControl labels={labels} />);

    await waitFor(() => {
      expect(root.style.getPropertyValue("--kb-scale")).toBe("1.2");
      expect(root.style.getPropertyValue("--kb-line-height")).toBe("1.5");
    });
    expect(button("放大: A+")).toBeDisabled();
    expect(button("减小行距: ☰-")).toBeDisabled();
  });

  it("ignores malformed and out-of-range persisted preferences", async () => {
    localStorage.setItem("tb-font-scale", "5");
    localStorage.setItem("tb-line-height", "0.5");

    render(<FontSizeControl labels={labels} />);

    await waitFor(() => expect(button("放大: A+")).toBeEnabled());
    expect(root.style.getPropertyValue("--kb-scale")).toBe("");
    expect(root.style.getPropertyValue("--kb-line-height")).toBe("");
    expect(button("增大行距: ☰+")).toBeEnabled();
    expect(button("减小行距: ☰-")).toBeEnabled();
  });

  it("updates and persists font scale while clamping at both bounds", () => {
    render(<FontSizeControl labels={labels} />);

    const larger = button("放大: A+");
    for (let index = 0; index < 10; index += 1) fireEvent.click(larger);
    expect(root.style.getPropertyValue("--kb-scale")).toBe("1.2");
    expect(localStorage.getItem("tb-font-scale")).toBe("1.2");
    expect(larger).toBeDisabled();

    const smaller = button("缩小: A-");
    for (let index = 0; index < 10; index += 1) fireEvent.click(smaller);
    expect(root.style.getPropertyValue("--kb-scale")).toBe("0.9");
    expect(localStorage.getItem("tb-font-scale")).toBe("0.9");
    expect(smaller).toBeDisabled();
  });

  it("updates and persists line height while clamping at both bounds", () => {
    render(<FontSizeControl labels={labels} />);

    const increase = button("增大行距: ☰+");
    for (let index = 0; index < 10; index += 1) fireEvent.click(increase);
    expect(root.style.getPropertyValue("--kb-line-height")).toBe("2.2");
    expect(localStorage.getItem("tb-line-height")).toBe("2.2");
    expect(increase).toBeDisabled();

    const decrease = button("减小行距: ☰-");
    for (let index = 0; index < 10; index += 1) fireEvent.click(decrease);
    expect(root.style.getPropertyValue("--kb-line-height")).toBe("1.5");
    expect(localStorage.getItem("tb-line-height")).toBe("1.5");
    expect(decrease).toBeDisabled();
  });

  it("keeps controls functional when storage access fails", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    render(<FontSizeControl labels={labels} />);
    fireEvent.click(button("放大: A+"));
    fireEvent.click(button("增大行距: ☰+"));

    expect(root.style.getPropertyValue("--kb-scale")).toBe("1.05");
    expect(root.style.getPropertyValue("--kb-line-height")).toBe("1.95");
  });
});
