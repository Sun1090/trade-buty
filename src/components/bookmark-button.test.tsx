// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  isBookmarked: vi.fn(() => false),
  toggleBookmark: vi.fn(() => true),
}));

vi.mock("@/lib/bookmarks", () => ({
  isBookmarked: mocks.isBookmarked,
  toggleBookmark: mocks.toggleBookmark,
}));

import { BookmarkButton } from "./bookmark-button";

const labels = { bookmark: "收藏", bookmarked: "已收藏" };

beforeEach(() => {
  mocks.isBookmarked.mockReset();
  mocks.isBookmarked.mockReturnValue(false);
  mocks.toggleBookmark.mockClear();
});

describe("BookmarkButton", () => {
  it("renders the un-bookmarked state", () => {
    render(
      <BookmarkButton
        chapter="getting-started"
        doc="first-trade"
        title="第一笔交易"
        label={labels}
      />,
    );
    const button = screen.getByRole("button", { name: "收藏" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button.textContent).toContain("☆");
  });

  it("renders the bookmarked state from the store", () => {
    mocks.isBookmarked.mockReturnValue(true);
    render(
      <BookmarkButton
        chapter="getting-started"
        doc="first-trade"
        title="第一笔交易"
        label={labels}
      />,
    );
    const button = screen.getByRole("button", { name: "已收藏" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button.textContent).toContain("★");
  });

  it("toggles the bookmark with chapter, doc and title", () => {
    render(
      <BookmarkButton
        chapter="risk"
        doc="position-sizing"
        title="仓位管理"
        label={labels}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "收藏" }));
    expect(mocks.toggleBookmark).toHaveBeenCalledWith(
      "risk",
      "position-sizing",
      "仓位管理",
    );
  });

  it("shows the textual label only when labelled is set", () => {
    const { rerender } = render(
      <BookmarkButton
        chapter="risk"
        doc="position-sizing"
        title="仓位管理"
        label={labels}
      />,
    );
    expect(screen.queryByText("收藏")).toBeNull();
    rerender(
      <BookmarkButton
        chapter="risk"
        doc="position-sizing"
        title="仓位管理"
        label={labels}
        labeled
      />,
    );
    expect(screen.getByText("收藏")).toBeInTheDocument();
  });
});
