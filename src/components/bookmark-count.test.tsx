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
import { getDict } from "@/lib/i18n";

beforeEach(() => {
  mocks.readBookmarks.mockReset();
  mocks.readBookmarks.mockReturnValue({});
});

// 生产传的就是 `layout.tsx` 里那一个 `t.bookmarks.nav`；夹具自造一个「项收藏」，
// 测到的可访问名称就不可能是上线的那一个。
const label = getDict("zh").bookmarks.nav;

describe("BookmarkCount", () => {
  it("renders nothing when there are no bookmarks", () => {
    const { container } = render(<BookmarkCount label={label} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the count with an accessible label", () => {
    mocks.readBookmarks.mockReturnValue({ a: {}, b: {} });
    render(<BookmarkCount label={label} />);
    expect(screen.getByLabelText(`2 ${label}`)).toHaveTextContent("2");
  });

  it("refreshes when the bookmarks event fires", () => {
    const { container } = render(<BookmarkCount label={label} />);
    expect(container).toBeEmptyDOMElement();

    mocks.readBookmarks.mockReturnValue({ a: {} });
    act(() => {
      window.dispatchEvent(new Event("tb-bookmarks"));
    });
    expect(screen.getByLabelText(`1 ${label}`)).toBeInTheDocument();
  });

  it("drops the badge when the last bookmark is removed", () => {
    mocks.readBookmarks.mockReturnValue({ a: {} });
    const { container } = render(<BookmarkCount label={label} />);
    expect(screen.getByLabelText(`1 ${label}`)).toBeInTheDocument();

    mocks.readBookmarks.mockReturnValue({});
    act(() => {
      window.dispatchEvent(new Event("tb-bookmarks"));
    });
    expect(container).toBeEmptyDOMElement();
  });
});
