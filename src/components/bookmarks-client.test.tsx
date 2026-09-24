// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { getDict } from "@/lib/i18n";
import { BookmarksClient } from "./bookmarks-client";
import { BookmarkButton } from "./bookmark-button";

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

    expect(screen.getByText("还没有收藏课程")).toBeInTheDocument();
    const cta = screen.getByTestId("bookmarks-empty-cta");
    expect(cta).toBeInTheDocument();
    expect(cta.getAttribute("href")).toBe("/zh/path");
    expect(cta.textContent).toContain("去看学习路线");
  });

  it("en locale 时 CTA 文案走英文且 href 走 /en/path", async () => {
    render(<BookmarksClient locale="en" emptyLabel="No bookmarks" />);

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

    expect(screen.queryByTestId("bookmarks-empty-cta")).toBeNull();
    // 列表 link 指向 /zh/knowledge/...
    expect(screen.getByText("Market Overview")).toBeInTheDocument();
  });
});

/**
 * R16.141：空态那句让用户「点击 ★」，而 `bookmark-button.tsx` 的星是
 * `{active ? "★" : "☆"}`——会看到这行字的人一条收藏都没有，因此他面前永远是 ☆。
 * 那句话替他描述的是一个他此刻按不到的东西（同 R16.127 那一族）。
 */
describe("书签空态点名的是眼前真的有的那颗", () => {
  it("两语都不提 ★，点名的按钮名与未收藏态的星都对得上", () => {
    for (const locale of ["zh", "en"] as const) {
      const t = getDict(locale);
      const empty = t.bookmarks.empty;
      expect(empty, "空态还在指一颗未收藏态根本不出现的实心星").not.toContain("★");
      const quoted = [...empty.matchAll(/[「“]([^」”]+)[」”]/g)].map((m) => m[1]);
      expect(quoted.length, `空态没点名任何按钮，这条检查是空转：${empty}`).toBe(1);
      expect(quoted[0], `${locale} 空态点名的不是收藏按钮的标签`).toBe(t.docTools.bookmark);
      expect(empty, `${locale} 空态没写出未收藏态那颗星的真实样子`).toContain("☆");
    }
  });

  it("未收藏态真的渲染出「☆ + 那个标签」这颗按钮", () => {
    const t = getDict("zh");
    render(
      <BookmarkButton
        chapter="getting-started"
        doc="market-overview"
        title="市场概览"
        label={{ bookmark: t.docTools.bookmark, bookmarked: t.docTools.bookmarked }}
        labeled
      />,
    );
    const button = screen.getByRole("button", { name: t.docTools.bookmark });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button.textContent).toContain("☆");
    expect(button.textContent).not.toContain("★");
  });
});

/**
 * R16.142：这一页是 SSG 出来的，首帧 `bookmarks` 恒为空数组，所以构建产物里那份
 * HTML 对每一个已经收藏过课程的访客都写着「还没有收藏课程」——关掉 JS 就永远是假的。
 * 读完存储之前不许下这个判断（`bookmark-count.tsx` 早就是「没读过就不印数字」）。
 */
describe("预渲染的那一帧不替访客断言他没有收藏", () => {
  const emptyLabel = getDict("zh").bookmarks.empty;

  it("服务端渲染只有外壳：没有那句判断，但框和那颗星还在", () => {
    const html = renderToString(<BookmarksClient locale="zh" emptyLabel={emptyLabel} />);
    expect(html).not.toContain(emptyLabel);
    expect(html).toContain("☆");
    expect(html).toContain("/zh/path");
  });

  it("正向对照：客户端读完存储之后那句必须出来，否则上一条只是永远闭嘴", () => {
    render(<BookmarksClient locale="zh" emptyLabel={emptyLabel} />);
    expect(screen.getByText(emptyLabel)).toBeInTheDocument();
  });
});
