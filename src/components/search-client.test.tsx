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

describe("SearchClient recent storage corruption", () => {
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ignores malformed or non-string recent-search JSON without blocking search", async () => {
    storage.setItem("tb-recent-search", "{not-json");

    render(<SearchClient dict={dict} />);
    const box = screen.getByRole("searchbox");
    expect(screen.queryByText(dict.recentLabel)).toBeNull();

    fireEvent.change(box, { target: { value: "definitely-no-such-lesson" } });
    expect(await screen.findByTestId("search-empty-cta")).toHaveAttribute("href", "/zh/path");
  });

  it("keeps only string terms from mixed recent-search arrays", async () => {
    storage.setItem("tb-recent-search", JSON.stringify(["止损", 7, null, "杠杆"]));

    render(<SearchClient dict={dict} />);
    expect(screen.getByText(dict.recentLabel)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "止损" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "杠杆" })).toBeInTheDocument();
    expect(screen.queryByText("7")).toBeNull();
  });
});

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

describe("SearchClient pagination and filtering", () => {
  const manyEntries = [
    ...Array.from({ length: 23 }, (_, i) => ({
      url: `/zh/knowledge/ch${i}/${String(i).padStart(2, "0")}`,
      title: `章节 ${i} 保证金`,
      // 第 23 条落在另一个篇章，且排在首页 20 条之后
      chapter: i === 22 ? "late" : "spot",
      text: `保证金 第 ${i} 条`,
    })),
    // 索引里存在的篇章，但对本次查询一条都不命中——真正的「该篇章暂无匹配」
    { url: "/zh/knowledge/empty/01", title: "空篇章课程", chapter: "empty", text: "与本查询无关" },
  ];

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => manyEntries }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * 页头那句「{n} 条结果」说的是命中数，不是这一页渲染了几行。
   * 旧实现读的是分页之后再筛选的 `filtered.length`，23 条命中会写成 20 条。
   */
  it("counts matches, not the rows currently on screen", async () => {
    render(<SearchClient dict={dict} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "保证金" } });

    expect(await screen.findByRole("button", { name: "加载更多" })).toBeInTheDocument();
    expect(screen.getByText("23 条结果")).toBeInTheDocument();
    expect(document.querySelectorAll("a[data-search-result-index]")).toHaveLength(20);

    fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "加载更多" })).toBeNull());
    expect(document.querySelectorAll("a[data-search-result-index]")).toHaveLength(23);
    expect(screen.getByText("23 条结果")).toBeInTheDocument();
  });

  /**
   * 筛选必须发生在截断之前：命中的那一行排在第 21 位之后时，
   * 旧实现会对着确实存在的结果说「该篇章暂无匹配」，而且翻页也翻不到。
   */
  it("reaches a chapter's matches even when they rank past the first page", async () => {
    render(<SearchClient dict={dict} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "保证金" } });

    const filter = await screen.findByRole("combobox", { name: dict.filterLabel });
    fireEvent.change(filter, { target: { value: "late" } });

    await waitFor(() => expect(screen.getByText("1 条结果")).toBeInTheDocument());
    expect(screen.queryByText(/暂无匹配/)).toBeNull();
    const rows = document.querySelectorAll("a[data-search-result-index]");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute("href", "/zh/knowledge/ch22/22");
  });

  it("shows a recoverable zero-filter state and clears the chapter filter", async () => {
    render(<SearchClient dict={dict} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "保证金" } });

    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
    const filter = await screen.findByRole("combobox", { name: dict.filterLabel });
    fireEvent.change(filter, { target: { value: "empty" } });

    await waitFor(() => expect(screen.getByText(dict.filterZeroCta)).toBeInTheDocument());
    expect(document.querySelectorAll("a[data-search-result-index]")).toHaveLength(0);
    expect(screen.getByText(/「empty」暂无匹配/)).toBeInTheDocument();

    fireEvent.click(screen.getByText(dict.filterZeroCta));
    expect(document.querySelectorAll("a[data-search-result-index]")).toHaveLength(20);
  });
});

describe("SearchClient recent searches", () => {
  const recents = () => JSON.parse(storage.getItem("tb-recent-search") ?? "[]");

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("surfaces saved recent searches and runs them on click", async () => {
    storage.setItem("tb-recent-search", JSON.stringify(["移动平均线", "杠杆"]));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ url: "/zh/knowledge/moving-average", title: "移动平均线", chapter: "spot", text: "均线" }],
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SearchClient dict={dict} />);
    expect(screen.getByText("移动平均线")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "移动平均线" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByRole("searchbox")).toHaveValue("移动平均线");
    expect(recents()).toEqual(["移动平均线", "杠杆"]);
  });

  it("does not create recent search entries while the query is empty", () => {
    render(<SearchClient dict={dict} />);
    fireEvent.click(screen.getByRole("searchbox"));
    expect(recents()).toEqual([]);
  });
});

/**
 * 输入联想是搜索里唯一「键盘可达但此前没有断言」的路径：结果列表的导航被测过，
 * 联想下拉从未被测——因为老用例一进 keyboard 块就先按 Escape 把它关掉了。
 */
describe("SearchClient 输入联想与零结果诊断", () => {
  const entries = [
    {
      url: "/zh/knowledge/spot/order-types",
      title: "订单类型",
      chapter: "spot",
      text: "限价单 市价单 成交价",
    },
    {
      url: "/zh/knowledge/futures/orders",
      title: "期货订单",
      chapter: "futures",
      text: "交割 合约乘数",
    },
  ];

  beforeEach(() => {
    storage.clear();
    mockPush.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => entries })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const type = (value: string) => {
    fireEvent.change(screen.getByRole("searchbox"), { target: { value } });
  };

  it("方向键在联想列表里移动高亮，Enter 打开高亮的那一条", async () => {
    render(<SearchClient dict={dict} />);
    const box = screen.getByRole("searchbox");
    type("订单");

    const listbox = await screen.findByRole("listbox", { name: "相关课程" });
    expect(within(listbox).getAllByRole("option")).toHaveLength(2);

    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(box).toHaveAttribute("aria-activedescendant", "search-suggestion-0");

    // 到底不再越界
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(box).toHaveAttribute("aria-activedescendant", "search-suggestion-1");

    fireEvent.keyDown(box, { key: "ArrowUp" });
    expect(box).toHaveAttribute("aria-activedescendant", "search-suggestion-0");

    fireEvent.keyDown(box, { key: "Enter" });
    expect(mockPush).toHaveBeenCalledWith("/zh/knowledge/spot/order-types");
  });

  it("Escape 关掉联想后，Enter 才落到结果列表上", async () => {
    render(<SearchClient dict={dict} />);
    const box = screen.getByRole("searchbox");
    type("订单");
    await screen.findByRole("listbox", { name: "相关课程" });
    await waitFor(() =>
      expect(document.querySelector('a[data-search-result-index="0"]')).not.toBeNull()
    );

    fireEvent.keyDown(box, { key: "Escape" });
    expect(screen.queryByRole("listbox", { name: "相关课程" })).toBeNull();
    expect(box).not.toHaveAttribute("aria-activedescendant");

    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(mockPush).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: "Enter" });
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it("鼠标掠过联想项即高亮，输入框失焦后下拉自动关闭", async () => {
    render(<SearchClient dict={dict} />);
    const box = screen.getByRole("searchbox");
    type("订单");

    const options = await screen.findAllByRole("option");
    expect(options.length).toBeGreaterThan(1);
    fireEvent.mouseEnter(options[1]);
    expect(options[1]).toHaveAttribute("aria-selected", "true");

    fireEvent.blur(box);
    await waitFor(
      () => expect(screen.queryByRole("listbox", { name: "相关课程" })).toBeNull(),
      { timeout: 1_000 }
    );
  });

  it("疑似拼错时给出可点击的近义词，点击后重新检索", async () => {
    render(<SearchClient dict={dict} />);
    type("订单类形");

    await screen.findByText(dict.noResults);
    const chip = await screen.findByRole("button", { name: "订单类型" });
    fireEvent.click(chip);

    expect(screen.getByRole("searchbox")).toHaveValue("订单类型");
    // 换词后有结果：空结果卡片消失，联想下拉重新出现
    await waitFor(() =>
      expect(screen.queryByTestId("search-empty-cta")).toBeNull()
    );
  });

  it("同义词组内确实没有内容时说明检索过的词，而不是假装拼错", async () => {
    render(<SearchClient dict={dict} />);
    type("dca");

    // 索引是异步加载的：entries 到位之前 diag 为 null，空结果卡片会先以「裸状态」渲染一次。
    await screen.findByText(dict.gapHint);
    expect(screen.queryByText(dict.didYouMean)).toBeNull();
    expect(screen.getByText(/已按同义说法搜索/)).toBeInTheDocument();
  });

  it("零结果页的热门词条按钮直接换词检索", async () => {
    render(<SearchClient dict={dict} />);
    type("zzzzqqqq");

    await screen.findByText(dict.noResults);
    fireEvent.click(screen.getByRole("button", { name: "保证金" }));
    expect(screen.getByRole("searchbox")).toHaveValue("保证金");
  });
});
