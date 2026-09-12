import { describe, expect, it } from "vitest";
import { BoundedMap, sweepExpired } from "./bounded-map";

describe("BoundedMap", () => {
  it("在容量内正常读写/删除", () => {
    const m = new BoundedMap<string, number>(3);
    m.set("a", 1).set("b", 2);
    expect(m.get("a")).toBe(1);
    expect(m.has("b")).toBe(true);
    expect(m.size).toBe(2);
    expect(m.delete("a")).toBe(true);
    expect(m.get("a")).toBeUndefined();
  });

  it("超过上限时淘汰最旧的 key（FIFO）", () => {
    const m = new BoundedMap<string, number>(2);
    m.set("a", 1).set("b", 2).set("c", 3);
    expect(m.has("a")).toBe(false);
    expect(m.has("b")).toBe(true);
    expect(m.has("c")).toBe(true);
    expect(m.size).toBe(2);
  });

  it("重写已有 key 会刷新其新鲜度", () => {
    const m = new BoundedMap<string, number>(2);
    m.set("a", 1).set("b", 2);
    m.set("a", 10); // a 变最新
    m.set("c", 3); // 淘汰 b
    expect(m.has("a")).toBe(true);
    expect(m.get("a")).toBe(10);
    expect(m.has("b")).toBe(false);
  });

  it("容量不会超过上限（大量写入）", () => {
    const m = new BoundedMap<number, number>(50);
    for (let i = 0; i < 5000; i++) m.set(i, i);
    expect(m.size).toBe(50);
    expect(m.has(4999)).toBe(true);
    expect(m.has(0)).toBe(false);
  });

  it("非法容量直接报错，避免静默退化成无限 Map", () => {
    expect(() => new BoundedMap<string, number>(0)).toThrow(RangeError);
    expect(() => new BoundedMap<string, number>(Number.NaN)).toThrow(RangeError);
  });
});

describe("sweepExpired", () => {
  it("未达阈值时不扫描", () => {
    const m = new BoundedMap<string, number>(10);
    m.set("a", 0);
    expect(sweepExpired(m, (v) => v === 0, 5)).toBe(0);
    expect(m.size).toBe(1);
  });

  it("达到阈值时清掉过期条目", () => {
    const m = new BoundedMap<string, number>(10);
    for (let i = 0; i < 6; i++) m.set(`k${i}`, i);
    expect(sweepExpired(m, (v) => v < 3, 5)).toBe(3);
    expect(m.size).toBe(3);
  });
});
