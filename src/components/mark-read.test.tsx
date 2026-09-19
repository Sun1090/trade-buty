// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ markRead: vi.fn() }));
vi.mock("@/lib/progress", () => ({ markRead: mocks.markRead }));

import { MarkRead } from "./mark-read";

function setViewport({ scrollHeight, innerHeight, scrollY }: {
  scrollHeight: number;
  innerHeight: number;
  scrollY: number;
}) {
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: innerHeight,
  });
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value: scrollY,
  });
}

function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { configurable: true, value: y });
  act(() => window.dispatchEvent(new Event("scroll")));
}

describe("MarkRead", () => {
  beforeEach(() => {
    mocks.markRead.mockClear();
    setViewport({ scrollHeight: 2000, innerHeight: 1000, scrollY: 0 });
  });

  afterEach(() => vi.restoreAllMocks());

  it("marks content that fits in one viewport immediately without retaining a listener", () => {
    setViewport({ scrollHeight: 800, innerHeight: 1000, scrollY: 0 });
    const add = vi.spyOn(window, "addEventListener");

    render(<MarkRead chapterNum="spot" docSlug="doc-a" />);

    expect(mocks.markRead).toHaveBeenCalledOnce();
    expect(mocks.markRead).toHaveBeenCalledWith("spot", "doc-a");
    expect(add).not.toHaveBeenCalledWith("scroll", expect.any(Function), expect.anything());
  });

  it("marks once only after scrolling beyond half of the document", () => {
    render(<MarkRead chapterNum="stocks" docSlug="risk" />);

    scrollTo(500);
    expect(mocks.markRead).not.toHaveBeenCalled();

    scrollTo(501);
    expect(mocks.markRead).toHaveBeenCalledOnce();
    expect(mocks.markRead).toHaveBeenCalledWith("stocks", "risk");

    scrollTo(900);
    expect(mocks.markRead).toHaveBeenCalledOnce();
  });

  it("resets tracking when the document identity changes", () => {
    const { rerender } = render(<MarkRead chapterNum="spot" docSlug="first" />);
    scrollTo(600);
    expect(mocks.markRead).toHaveBeenLastCalledWith("spot", "first");

    setViewport({ scrollHeight: 2000, innerHeight: 1000, scrollY: 0 });
    rerender(<MarkRead chapterNum="futures" docSlug="second" />);
    scrollTo(600);

    expect(mocks.markRead).toHaveBeenCalledTimes(2);
    expect(mocks.markRead).toHaveBeenLastCalledWith("futures", "second");
  });

  it("removes the scroll listener on unmount before completion", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<MarkRead chapterNum="spot" docSlug="doc-a" />);

    unmount();

    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
