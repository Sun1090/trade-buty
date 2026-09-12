// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  readBookmarks: vi.fn<() => Record<string, unknown>>(() => ({})),
}));

vi.mock("@/lib/bookmarks", () => ({
  readBookmarks: mocks.readBookmarks,
}));

import { BookmarkCount } from "./bookmark-count";

beforeEach(() => {
  mocks.readBookmarks.mockReset();
  mocks.readBookmarks.mockReturnValue({});
});

describe("BookmarkCount", () => {
  it("renders nothing when there are no bookmarks", () => {
    const { container } = render(<BookmarkCount label="项收藏" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the count with an accessible label", () => {
    mocks.readBookmarks.mockReturnValue({ a: {}, b: {} });
    render(<BookmarkCount label="项收藏" />);
    expect(screen.getByLabelText("2 项收藏")).toHaveTextContent("2");
  });

  it("refreshes when the bookmarks event fires", () => {
    const { container } = render(<BookmarkCount label="项收藏" />);
    expect(container).toBeEmptyDOMElement();

    mocks.readBookmarks.mockReturnValue({ a: {} });
    act(() => {
      window.dispatchEvent(new Event("tb-bookmarks"));
    });
    expect(screen.getByLabelText("1 项收藏")).toBeInTheDocument();
  });

  it("drops the badge when the last bookmark is removed", () => {
    mocks.readBookmarks.mockReturnValue({ a: {} });
    const { container } = render(<BookmarkCount label="项收藏" />);
    expect(screen.getByLabelText("1 项收藏")).toBeInTheDocument();

    mocks.readBookmarks.mockReturnValue({});
    act(() => {
      window.dispatchEvent(new Event("tb-bookmarks"));
    });
    expect(container).toBeEmptyDOMElement();
  });
});
