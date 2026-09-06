import { describe, expect, it } from "vitest";
import {
  chainFromSorted,
  walkChain,
  duplicateOrders,
  sharedOrderViolations,
} from "../../scripts/nav-chain-lib.mjs";

describe("nav-chain lib (R10.10)", () => {
  describe("chainFromSorted", () => {
    it("为有序 slug 构造 prev/next 链", () => {
      const { head, tail, prev, next } = chainFromSorted(["a", "b", "c"]);
      expect(head).toBe("a");
      expect(tail).toBe("c");
      expect(prev.get("a")).toBeNull();
      expect(prev.get("b")).toBe("a");
      expect(prev.get("c")).toBe("b");
      expect(next.get("a")).toBe("b");
      expect(next.get("b")).toBe("c");
      expect(next.get("c")).toBeNull();
    });

    it("空/单元素边界", () => {
      expect(chainFromSorted([])).toMatchObject({ head: null, tail: null });
      const one = chainFromSorted(["only"]);
      expect(one.head).toBe("only");
      expect(one.next.get("only")).toBeNull();
    });
  });

  describe("walkChain", () => {
    it("clean 链走完全部节点", () => {
      const { head, next } = chainFromSorted(["a", "b", "c", "d"]);
      const r = walkChain(head, next, 4);
      expect(r.ok).toBe(true);
      expect(r.cycle).toBe(false);
      expect(r.order).toEqual(["a", "b", "c", "d"]);
    });

    it("检测自环", () => {
      const next = new Map([["a", "a"]]);
      const r = walkChain("a", next, 1);
      expect(r.ok).toBe(false);
      expect(r.cycle).toBe(true);
    });

    it("检测成环（next 指回前序节点）", () => {
      const next = new Map([
        ["a", "b"],
        ["b", "c"],
        ["c", "b"], // 回到 b → 环
      ]);
      const r = walkChain("a", next, 3);
      expect(r.cycle).toBe(true);
      expect(r.ok).toBe(false);
    });

    it("检测覆盖不足（分叉/缺失：走完数量 ≠ 总数）", () => {
      // d 不在任何 next 上 → 链走不完总数
      const next = new Map([
        ["a", "b"],
        ["b", "c"],
        ["c", null],
      ]);
      const r = walkChain("a", next, 4);
      expect(r.cycle).toBe(false);
      expect(r.ok).toBe(false);
      expect(r.order).toEqual(["a", "b", "c"]);
    });

    it("head 为 null（空章节）视为通过", () => {
      const r = walkChain(null, new Map(), 0);
      expect(r.ok).toBe(true);
      expect(r.cycle).toBe(false);
      expect(r.order).toEqual([]);
    });
  });

  describe("duplicateOrders", () => {
    it("发现显式编号重复（排序歧义）", () => {
      const dups = duplicateOrders([
        { slug: "a", order: 2 },
        { slug: "b", order: 2 },
        { slug: "c", order: 3 },
      ]);
      expect(dups).toEqual([{ order: 2, slugs: ["a", "b"] }]);
    });

    it("999 兜底（无前导数字）重复不算歧义——同序回退 slug 字母序是设计内", () => {
      const dups = duplicateOrders([
        { slug: "aaa", order: 999 },
        { slug: "zzz", order: 999 },
        { slug: "num", order: 5 },
      ]);
      expect(dups).toEqual([]);
    });

    it("无重复返回空", () => {
      expect(duplicateOrders([{ slug: "a", order: 1 }, { slug: "b", order: 2 }])).toEqual([]);
    });
  });

  describe("sharedOrderViolations", () => {
    it("en 与 zh 共享 slug 相对序一致时无违规", () => {
      const zh = ["a", "b", "c", "d"];
      const en = ["a", "en-only", "b", "c", "d"];
      expect(sharedOrderViolations({ zh, en })).toEqual([]);
    });

    it("en 相对序与 zh 冲突时报出冲突对", () => {
      const zh = ["a", "b", "c", "d"];
      // en 里 c 排在 b 前，与 zh（b 先于 c）冲突
      const en = ["c", "b", "a", "d"];
      const violations = sharedOrderViolations({ zh, en });
      expect(violations).toEqual([["c", "b"], ["c", "a"], ["b", "a"]]);
    });

    it("en 独有 slug 不参与相对序比较", () => {
      const zh = ["a", "b"];
      const en = ["a", "en-extra", "b"];
      expect(sharedOrderViolations({ zh, en })).toEqual([]);
    });
  });
});
