// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  recordInvite,
  readInvite,
  clearInvite,
  getRefFromUrl,
  INVITE_STORAGE_KEY,
  INVITE_TTL_MS,
} from "./invite-ref";

/**
 * R8.5 邀请参数单测：纯逻辑（localStorage 由 jsdom 提供）。
 *
 * 注：vitest 默认环境是 node，但本文件顶部声明 jsdom 环境。
 * 如果 jsdom 没装好，localStorage 会是 undefined——所以提供一个简易内存 stub 兜底。
 */

const memStore: Record<string, string> = {};
if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage) {
  // 兜底：内存版 storage（vitest jsdom 没启用时）
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

function setNow(ms: number) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(ms));
}

beforeEach(() => {
  if (typeof localStorage !== "undefined") localStorage.clear();
  vi.useRealTimers();
});

describe("invite-ref record/read/clear", () => {
  it("未写入时 readInvite 返回 null", () => {
    expect(readInvite()).toBeNull();
  });

  it("写入后能读出", () => {
    const now = 1_700_000_000_000;
    setNow(now);
    expect(recordInvite("alice", now)).toBe(true);
    const r = readInvite(now);
    expect(r).not.toBeNull();
    expect(r?.ref).toBe("alice");
    expect(r?.expiresAt).toBe(now + INVITE_TTL_MS);
    expect(r?.recordedAt).toBe(now);
    vi.useRealTimers();
  });

  it("超过 TTL 返回 null 并清除 storage", () => {
    const t0 = 1_700_000_000_000;
    setNow(t0);
    recordInvite("bob", t0);
    expect(readInvite(t0 + INVITE_TTL_MS - 1)).not.toBeNull();
    expect(readInvite(t0 + INVITE_TTL_MS)).toBeNull();
    expect(localStorage.getItem(INVITE_STORAGE_KEY)).toBeNull();
    vi.useRealTimers();
  });

  it("clearInvite 清除 storage", () => {
    setNow(1_700_000_000_000);
    recordInvite("carol", 1_700_000_000_000);
    expect(readInvite(1_700_000_000_000)).not.toBeNull();
    clearInvite();
    expect(readInvite(1_700_000_000_000)).toBeNull();
    vi.useRealTimers();
  });

  it("无效 ref 被拒绝", () => {
    expect(recordInvite("")).toBe(false);
    expect(recordInvite("a".repeat(65))).toBe(false);
    expect(recordInvite("a b c")).toBe(false);
    expect(recordInvite("a/b")).toBe(false);
    expect(recordInvite("a$b")).toBe(false);
    expect(readInvite()).toBeNull();
  });

  it("recordInvite 覆盖旧记录", () => {
    const t0 = 1_700_000_000_000;
    setNow(t0);
    recordInvite("old", t0);
    recordInvite("new", t0);
    expect(readInvite(t0)?.ref).toBe("new");
    vi.useRealTimers();
  });
});

describe("invite-ref URL 解析", () => {
  it("从 query string 提取 ref", () => {
    expect(getRefFromUrl("?ref=abc")).toBe("abc");
    expect(getRefFromUrl("?foo=1&ref=demo&bar=2")).toBe("demo");
    expect(getRefFromUrl("?ref=")).toBeNull();
    expect(getRefFromUrl("")).toBeNull();
  });

  it("从 URLSearchParams 提取 ref", () => {
    const p = new URLSearchParams("?ref=zz");
    expect(getRefFromUrl(p)).toBe("zz");
  });

  it("非法 ref 不返回", () => {
    expect(getRefFromUrl("?ref=a%20b")).toBeNull();
    expect(getRefFromUrl("?ref=evil/x")).toBeNull();
  });
});

describe("invite-ref 存储防御", () => {
  it("读到 JSON 外的脏数据时返回 null", () => {
    setNow(1_700_000_000_000);
    localStorage.setItem(INVITE_STORAGE_KEY, "{not json");
    expect(readInvite(1_700_000_000_000)).toBeNull();
    vi.useRealTimers();
  });

  it("读到缺字段的对象时返回 null", () => {
    setNow(1_700_000_000_000);
    localStorage.setItem(INVITE_STORAGE_KEY, JSON.stringify({ ref: "ok" }));
    expect(readInvite(1_700_000_000_000)).toBeNull();
    vi.useRealTimers();
  });

  it("读到 ref 不合法的记录时清掉并返回 null", () => {
    setNow(1_700_000_000_000);
    localStorage.setItem(
      INVITE_STORAGE_KEY,
      JSON.stringify({ ref: "bad ref", recordedAt: 1, expiresAt: 1_700_000_999_999 }),
    );
    expect(readInvite(1_700_000_000_000)).toBeNull();
    expect(localStorage.getItem(INVITE_STORAGE_KEY)).toBeNull();
    vi.useRealTimers();
  });
});
