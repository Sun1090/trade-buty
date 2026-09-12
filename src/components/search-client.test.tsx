// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SearchClient } from "./search-client";

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/zh/search",
  useRouter: () => ({ push: mockPush }),
}));

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
  clear: () => values.clear(),
  key: (index: number) => Array.from(values.keys())[index] ?? null,
  get length() {
    return values.size;
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: storage,
  configurable: true,
  writable: true,
});

const dict = {
  placeholder: "搜索课程",
  resultsTpl: "{n} 条结果",
  noResults: "没有匹配的结果",
  emptyHint: "换个关键词试试，或者从学习路线开始。",
  browseCta: "从学习路线开始 →",
  recentLabel: "最近搜索",
  suggestTitle: "相关课程",
  didYouMean: "你是不是想找",
  triedSynTpl: "已按同义说法搜索：{terms}",
  gapHint: "该主题可能尚未收录。",
  filterZeroTpl: "「{chapter}」暂无匹配，站内共有 {n} 条相关结果",
  filterZeroCta: "查看全部结果",
  filterLabel: "按篇章筛选",
  indexError: "搜索索引暂时加载失败，请检查网络后重试。",
  retry: "重试",
};

describe("SearchClient no-results CTA (R13.18)", () => {
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("offers a prominent locale-correct learning-path exit after zero results", async () => {
    render(<SearchClient dict={dict} />);

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "definitely-no-such-lesson" },
    });

    await waitFor(
      () => {
        const cta = screen.getByTestId("search-empty-cta");
        expect(cta).toHaveAttribute("href", "/zh/path");
        expect(cta).toHaveTextContent("从学习路线开始");
      },
      { timeout: 2_000 }
    );
  });
});

describe("SearchClient index failure fallback (Q2.6 / R13.25)", () => {
  beforeEach(() => {
    storage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a retry fallback instead of a false no-results state when the index fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<SearchClient dict={dict} />);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "保证金" } });

    const alert = await screen.findByTestId("search-index-error");
    expect(alert).toHaveTextContent(dict.indexError);
    expect(screen.queryByTestId("search-empty-cta")).toBeNull();
  });

  it("recovers once the retry succeeds", async () => {
    const entry = [
      { url: "/zh/knowledge/spot/order-types", title: "订单类型", chapter: "spot", text: "限价单 市价单" },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce({ ok: true, json: async () => entry })
    );
    render(<SearchClient dict={dict} />);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "限价单" } });
    await screen.findByTestId("search-index-error");

    fireEvent.click(screen.getByRole("button", { name: dict.retry }));

    await waitFor(() => {
      expect(screen.queryByTestId("search-index-error")).toBeNull();
      expect(screen.queryByTestId("search-empty-cta")).toBeNull();
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("SearchClient accessibility (Q2.4)", () => {
  beforeEach(() => {
    storage.clear();
    mockPush.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("names the chapter filter for assistive technology", async () => {
    const entry = [
      { url: "/zh/knowledge/spot/order-types", title: "订单类型", chapter: "spot", text: "限价单" },
      { url: "/zh/knowledge/futures/orders", title: "期货订单", chapter: "futures", text: "限价单" },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => entry }));
    render(<SearchClient dict={dict} />);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "限价单" } });

    const filter = await screen.findByRole("combobox", { name: dict.filterLabel });
    expect(filter).toBeVisible();
    expect(screen.getByRole("option", { name: "全部篇章" })).toBeInTheDocument();
  });
});

describe("SearchClient keyboard navigation", () => {
  const resultLink = (index = 0) =>
    document.querySelector<HTMLAnchorElement>(
      `a[data-search-result-index="${index}"]`,
    );

  const entries = [
    {
      url: "/zh/knowledge/spot/order-types",
      title: "订单类型",
      chapter: "spot",
      text: "限价单 市价单 保证金",
    },
    {
      url: "/zh/knowledge/futures/orders",
      title: "期货订单",
      chapter: "futures",
      text: "限价单 保证金",
    },
  ];

  beforeEach(() => {
    storage.clear();
    mockPush.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => entries }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens the first matching result on Enter when none is highlighted", async () => {
    render(<SearchClient dict={dict} />);
    const box = screen.getByRole("searchbox");
    fireEvent.change(box, { target: { value: "限价单" } });

    await waitFor(() => expect(resultLink()).not.toBeNull());
    fireEvent.keyDown(box, { key: "Enter" });

    expect(mockPush).toHaveBeenCalledWith("/zh/knowledge/spot/order-types");
  });

  it("highlights on ArrowDown and resets the highlight when the query changes", async () => {
    render(<SearchClient dict={dict} />);
    const box = screen.getByRole("searchbox");
    fireEvent.change(box, { target: { value: "限价单" } });

    await waitFor(() => expect(resultLink()).not.toBeNull());

    fireEvent.keyDown(box, { key: "Escape" });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(resultLink()).toHaveAttribute("data-search-result-index", "0");
    expect(resultLink()?.className).toContain("border-accent");

    fireEvent.change(box, { target: { value: "期货" } });
    await waitFor(() =>
      expect(resultLink()?.textContent).toContain("期货订单"),
    );
    expect(resultLink()?.className).not.toContain("border-accent");
  });

  it("exposes the suggestion listbox and active option to assistive technology", async () => {
    render(<SearchClient dict={dict} />);
    const box = screen.getByRole("searchbox");
    fireEvent.change(box, { target: { value: "限价单" } });

    const listbox = await screen.findByRole("listbox");
    expect(box).toHaveAttribute("aria-controls", "search-suggestions");
    expect(box).toHaveAttribute("aria-autocomplete", "list");
    expect(box).not.toHaveAttribute("aria-activedescendant");

    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(box).toHaveAttribute(
      "aria-activedescendant",
      "search-suggestion-0",
    );
    expect(within(listbox).getAllByRole("option")[0]).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.keyDown(box, { key: "Escape" });
    expect(box).not.toHaveAttribute("aria-activedescendant");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("SearchClient 最近搜索（回归：与 debounce 后的检索词对齐）", () => {
  const entry = [
    {
      url: "/zh/knowledge/spot/order-types",
      title: "订单类型",
      chapter: "spot",
      text: "限价单 市价单 保证金",
    },
  ];

  const recents = () => JSON.parse(storage.getItem("tb-recent-search") ?? "[]");

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => entry }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("debounce 完成后记录检索词，且不因结果条数相同而漏记", async () => {
    render(<SearchClient dict={dict} />);
    const box = screen.getByRole("searchbox");

    fireEvent.change(box, { target: { value: "限价单" } });
    await waitFor(() => expect(recents()).toEqual(["限价单"]));

    // 第二次检索结果条数仍是 1——旧实现依赖 results.length，会漏记这一次
    fireEvent.change(box, { target: { value: "市价单" } });
    await waitFor(() => expect(recents()).toEqual(["市价单", "限价单"]));

    // 重复检索只做去重前置，不产生重复条目
    fireEvent.change(box, { target: { value: "限价单" } });
    await waitFor(() => expect(recents()).toEqual(["限价单", "市价单"]));
  });

  it("没有命中的检索词不进入最近搜索", async () => {
    render(<SearchClient dict={dict} />);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "完全不存在的课程关键词" },
    });
    await waitFor(() => expect(screen.getByTestId("search-empty-cta")).toBeInTheDocument());
    expect(recents()).toEqual([]);
  });
});
