// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  touchLastVisit,
  getLastVisitAt,
  markNudgeShown,
  getLastNudgeShownAt,
  shouldShowReturnNudge,
  daysSinceLastVisit,
  RETURN_NUDGE_INTERVAL_MS,
} from "./last-visit";

/**
 * R9.8 单测：7 天未访温和提示逻辑。
 * 顶部声明 jsdom 环境；jsdom 没装好时回落到内存 stub。
 */

const memStore: Record<string, string> = {};
if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage) {
  const stub: Storage = {
    getItem: (k: string) => (k in memStore ? memStore[k] : null),
    setItem: (k: string, v: string) => { memStore[k] = v; },
    removeItem: (k: string) => { delete memStore[k]; },
    clear: () => { for (const k of Object.keys(memStore)) delete memStore[k]; },
    key: (i: number) => Object.keys(memStore)[i] ?? null,
    get length() { return Object.keys(memStore).length; },
  };
  try {
    Object.defineProperty(globalThis, "localStorage", { value: stub, configurable: true });
  } catch { /* noop */ }
}

beforeEach(() => {
  if (typeof localStorage !== "undefined") localStorage.clear();
  vi.useRealTimers();
});

describe("last-visit basic IO (R9.8)", () => {
  it("初始无记录：getLastVisitAt 返回 null", () => {
    expect(getLastVisitAt()).toBeNull();
  });

  it("touchLastVisit 后能读回", () => {
    touchLastVisit(1_000_000);
    expect(getLastVisitAt()).toBe(1_000_000);
  });

  it("markNudgeShown 后能读回", () => {
    markNudgeShown(5_000_000);
    expect(getLastNudgeShownAt()).toBe(5_000_000);
  });

  it("字段防御：storage 里有非数字值 → 视为无记录", () => {
    localStorage.setItem("tb-last-visit", "not-a-number");
    expect(getLastVisitAt()).toBeNull();
  });

  it("字段防御：storage 里有负数 → 视为无记录", () => {
    localStorage.setItem("tb-last-visit", "-1000");
    expect(getLastVisitAt()).toBeNull();
  });

  it("RETURN_NUDGE_INTERVAL_MS 等于 7d", () => {
    expect(RETURN_NUDGE_INTERVAL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("shouldShowReturnNudge (R9.8)", () => {
  it("首次访问（无 lastVisit）不弹", () => {
    const now = 200_000_000_000;
    expect(shouldShowReturnNudge(now)).toBe(false);
  });

  it("6 天前访问过不弹", () => {
    const now = 10 * 24 * 60 * 60 * 1000;
    touchLastVisit(now - 6 * 24 * 60 * 60 * 1000);
    expect(shouldShowReturnNudge(now)).toBe(false);
  });

  it("7 天前访问过且从未弹过提示 → true", () => {
    const now = 10 * 24 * 60 * 60 * 1000;
    touchLastVisit(now - 7 * 24 * 60 * 60 * 1000);
    expect(shouldShowReturnNudge(now)).toBe(true);
  });

  it("10 天前访问过且从未弹过 → true", () => {
    const now = 10 * 24 * 60 * 60 * 1000;
    touchLastVisit(now - 10 * 24 * 60 * 60 * 1000);
    expect(shouldShowReturnNudge(now)).toBe(true);
  });

  it("7d 内已经弹过 → false（防抖）", () => {
    const now = 10 * 24 * 60 * 60 * 1000;
    touchLastVisit(now - 8 * 24 * 60 * 60 * 1000);
    markNudgeShown(now - 2 * 24 * 60 * 60 * 1000);
    expect(shouldShowReturnNudge(now)).toBe(false);
  });

  it("上次弹距今 ≥ 7d → 重新弹", () => {
    const now = 30 * 24 * 60 * 60 * 1000;
    touchLastVisit(now - 8 * 24 * 60 * 60 * 1000);
    markNudgeShown(now - 8 * 24 * 60 * 60 * 1000);
    expect(shouldShowReturnNudge(now)).toBe(true);
  });

  it("超过 90d 未访 → false（视为断签）", () => {
    const now = 200 * 24 * 60 * 60 * 1000;
    touchLastVisit(now - 100 * 24 * 60 * 60 * 1000);
    expect(shouldShowReturnNudge(now)).toBe(false);
  });
});

describe("daysSinceLastVisit (R9.8)", () => {
  it("正常值", () => {
    const now = 200_000_000_000;
    touchLastVisit(now - 3 * 24 * 60 * 60 * 1000);
    expect(daysSinceLastVisit(now)).toBe(3);
  });

  it("无记录 → null", () => {
    expect(daysSinceLastVisit(200_000_000_000)).toBeNull();
  });

  it("时间在未来 → 0", () => {
    const now = 200_000_000_000;
    touchLastVisit(now + 5000);
    expect(daysSinceLastVisit(now)).toBe(0);
  });
});

describe("last-visit SSR safety (R9.8)", () => {
  let originalDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, "localStorage", originalDescriptor);
    }
  });

  it("无 localStorage 时所有函数静默", () => {
    Object.defineProperty(globalThis, "localStorage", { value: undefined, configurable: true, writable: true });
    expect(() => touchLastVisit(1234)).not.toThrow();
    expect(getLastVisitAt()).toBeNull();
    expect(getLastNudgeShownAt()).toBeNull();
    expect(shouldShowReturnNudge(200_000_000_000)).toBe(false);
    expect(daysSinceLastVisit(200_000_000_000)).toBeNull();
    expect(() => markNudgeShown(1234)).not.toThrow();
  });
});

/**
 * R16.198：这条通道上「谁在写 storage」被注释说反过两次——一次把这个纯判断说成
 * 「归零 lastVisit」，一次说成「每次进入任意内容页（mount 内容组件时）」重写。
 * 实际的形状是：`AuthProvider`（挂在 layout 上、客户端切路由不会重挂）在它那
 * 个空依赖的 mount 效应里**读一次、判一次、写一次**，一次文档加载一趟。
 * 两头都钉：先跑一遍看它到底动没动台账，再看调用点的形状是不是注释说的那个。
 */
describe("90 天那一步只是判断，写的是调用方（R16.198）", () => {
  const DAY = 24 * 60 * 60 * 1000;

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
    }
    return out;
  }

  it("shouldShowReturnNudge 只读不写；让旧记录翻篇的是调用方那次 touchLastVisit", () => {
    const now = 200 * DAY;
    const stale = now - 100 * DAY;
    touchLastVisit(stale);
    expect(getLastVisitAt()).toBe(stale);

    expect(shouldShowReturnNudge(now, stale, null), "超过 90d 不该弹").toBe(false);
    expect(getLastVisitAt(), "这一步只是判断，不许顺手改台账").toBe(stale);

    touchLastVisit(now);
    expect(getLastVisitAt()).toBe(now);
    expect(shouldShowReturnNudge(now + 1_000, now, null), "刚写过，间隔是 0 天，不该弹").toBe(false);
  });

  it("注释不许说这一步会归零，也不许说成每次进内容页都写", () => {
    const src = readFileSync(path.join(process.cwd(), "src/lib/last-visit.ts"), "utf8");
    const header = src.slice(0, src.indexOf("const STORAGE_KEY"));
    expect(header, "把每页都写一遍当成了事实——只有一次文档加载会写").not.toMatch(/内容页|内容组件/);
    expect(header, "注释得点出真正的写入方，不然下一次还会抄错").toMatch(/AuthProvider/);

    const fn = src.slice(src.indexOf("export function shouldShowReturnNudge"));
    const doc = fn.slice(0, fn.indexOf("*/"));
    expect(doc, "这个函数只 return false，没有归零任何人").not.toMatch(/归零|清零|删除|removeItem/);
    const body = fn.slice(0, fn.indexOf("\n}"));
    expect(body, "判断函数一旦开始写 storage，上面那条注释就得跟着改口径").not.toMatch(/writeNum|setItem|removeItem/);
  });

  it("全仓唯一的 touchLastVisit 调用点就是 layout 上的 AuthProvider，且先读后写、依赖数组为空", () => {
    // 只认「这一行就是这个调用本身」：定义那行、注释里提到都不算
    const isCall = (line: string) => /^\s*touchLastVisit\(/.test(line);
    const hits = walk(path.join(process.cwd(), "src"))
      .filter((f) => readFileSync(f, "utf8").split("\n").some(isCall))
      .map((f) => path.relative(process.cwd(), f).split(path.sep).join("/"));
    expect(hits, "写入方一旦多起来，「每页都记」那句假话就又有了藏身处").toEqual(["src/components/auth-provider.tsx"]);

    const caller = readFileSync(path.join(process.cwd(), "src/components/auth-provider.tsx"), "utf8");
    expect(caller.indexOf("getLastVisitAt()"), "必须先读旧值").toBeLessThan(caller.indexOf("touchLastVisit(now)"));
    expect(caller, "那个效应是 mount 一次，不是每次路由切换").toMatch(/void import\("@\/lib\/last-visit"\)[\s\S]*?\}, \[\]\);/);
  });
});
