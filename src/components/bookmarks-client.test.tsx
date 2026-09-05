// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { BookmarksClient } from "./bookmarks-client";

/**
 * R8.7 BookmarksClient 空态 CTA 单测。
 * - 空时显示空态文案 + CTA 链接到 path
 * - 有书签时显示列表
 */

const memStore: Record<string, string> = {};
beforeEach(() => {
  cleanup();
  for (const k of Object.keys(memStore)) delete memStore[k];
  try {
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: (k: string) => (k in memStore ? memStore[k] : null),
        setItem: (k: string, v: string) => { memStore[k] = v; },
        removeItem: (k: string) => { delete memStore[k]; },
        clear: () => { for (const k of Object.keys(memStore)) delete memStore[k]; },
        key: (i: number) => Object.keys(memStore)[i] ?? null,
        get length() { return Object.keys(memStore).length; },
      },
      configurable: true,
      writable: true,
    });
  } catch { /* noop */ }
});

afterEach(() => {
  cleanup();
});

describe("BookmarksClient 空态", () => {
  it("空时显示 emptyLabel 与 CTA", async () => {
    render(<BookmarksClient locale="zh" emptyLabel="还没有收藏课程" />);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByText("还没有收藏课程")).toBeInTheDocument();
    const cta = screen.getByTestId("bookmarks-empty-cta");
    expect(cta).toBeInTheDocument();
    expect(cta.getAttribute("href")).toBe("/zh/path");
    expect(cta.textContent).toContain("去看学习路线");
  });

  it("en locale 时 CTA 文案走英文且 href 走 /en/path", async () => {
    render(<BookmarksClient locale="en" emptyLabel="No bookmarks" />);
    await new Promise((r) => setTimeout(r, 30));
    const cta = screen.getByTestId("bookmarks-empty-cta");
    expect(cta.getAttribute("href")).toBe("/en/path");
    expect(cta.textContent).toContain("Browse the learning path");
  });
});

describe("BookmarksClient 列表态", () => {
  it("有书签时不显示 CTA 而是显示链接", async () => {
    memStore["tb-bookmarks"] = JSON.stringify({
      "getting-started/market-overview": {
        chapter: "getting-started",
        doc: "market-overview",
        at: Date.now(),
        title: "Market Overview",
      },
    });
    render(<BookmarksClient locale="zh" emptyLabel="空" />);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId("bookmarks-empty-cta")).toBeNull();
    // 列表 link 指向 /zh/knowledge/...
    expect(screen.getByText("Market Overview")).toBeInTheDocument();
  });
});
