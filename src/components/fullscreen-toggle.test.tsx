// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { FullscreenToggle } from "./fullscreen-toggle";

const labels = { enter: "全屏", exit: "退出全屏" };
let fullscreenElement: Element | null = null;
let target: HTMLDivElement;

beforeEach(() => {
  fullscreenElement = null;
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => fullscreenElement,
  });
  target = document.createElement("div");
  target.id = "chart";
  target.requestFullscreen = vi.fn().mockResolvedValue(undefined);
  document.body.appendChild(target);
  document.exitFullscreen = vi.fn().mockResolvedValue(undefined);
});

afterEach(() => {
  target.remove();
});

describe("FullscreenToggle", () => {
  it("requests fullscreen on the target element", () => {
    render(<FullscreenToggle targetId="chart" label={labels} />);
    fireEvent.click(screen.getByRole("button", { name: "全屏" }));
    expect(target.requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the target id is missing", () => {
    render(<FullscreenToggle targetId="missing" label={labels} />);
    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: "全屏" })),
    ).not.toThrow();
    expect(target.requestFullscreen).not.toHaveBeenCalled();
  });

  it("exits fullscreen when already fullscreen", () => {
    render(<FullscreenToggle targetId="chart" label={labels} />);
    fullscreenElement = target;
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    fireEvent.click(screen.getByRole("button", { name: "退出全屏" }));
    expect(document.exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("reflects the fullscreen change label", () => {
    render(<FullscreenToggle targetId="chart" label={labels} />);
    expect(screen.getByRole("button", { name: "全屏" })).toBeInTheDocument();

    fullscreenElement = target;
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(screen.getByRole("button", { name: "退出全屏" })).toBeInTheDocument();

    fullscreenElement = null;
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(screen.getByRole("button", { name: "全屏" })).toBeInTheDocument();
  });

  it("ignores rejected fullscreen promises", async () => {
    target.requestFullscreen = vi.fn().mockRejectedValue(new Error("denied"));
    render(<FullscreenToggle targetId="chart" label={labels} />);
    fireEvent.click(screen.getByRole("button", { name: "全屏" }));
    await Promise.resolve();
    expect(screen.getByRole("button", { name: "全屏" })).toBeInTheDocument();
  });
});
