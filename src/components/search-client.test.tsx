// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SearchClient } from "./search-client";

vi.mock("next/navigation", () => ({
  usePathname: () => "/zh/search",
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
