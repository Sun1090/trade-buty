// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  isValidEmail,
  saveNewsletter,
  readNewsletter,
  clearNewsletter,
  exportNewsletter,
  NEWSLETTER_STORAGE_KEY,
} from "./newsletter";

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
  localStorage.clear();
});

describe("newsletter 邮箱校验", () => {
  it("基本格式合法", () => {
    expect(isValidEmail("a@b.c")).toBe(true);
    expect(isValidEmail("alice@example.com")).toBe(true);
    expect(isValidEmail("x+y@sub.example.co")).toBe(true);
  });

  it("非法格式拒绝", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("@b.c")).toBe(false);
    expect(isValidEmail("a@.c")).toBe(false);
    expect(isValidEmail("a b@c.d")).toBe(false);
    expect(isValidEmail("a".repeat(255))).toBe(false);
  });
});

describe("newsletter 读写清", () => {
  it("未写入时返回 null", () => {
    expect(readNewsletter()).toBeNull();
    expect(exportNewsletter()).toBeNull();
  });

  it("写入后能读出", () => {
    expect(saveNewsletter("alice@example.com", 1_700_000_000_000)).toBe(true);
    const r = readNewsletter();
    expect(r?.email).toBe("alice@example.com");
    expect(r?.recordedAt).toBe(1_700_000_000_000);
  });

  it("无效邮箱拒绝写入", () => {
    expect(saveNewsletter("nope")).toBe(false);
    expect(readNewsletter()).toBeNull();
    expect(localStorage.getItem(NEWSLETTER_STORAGE_KEY)).toBeNull();
  });

  it("clearNewsletter 清掉记录", () => {
    saveNewsletter("x@y.z", 1);
    clearNewsletter();
    expect(readNewsletter()).toBeNull();
  });

  it("读到脏 JSON 时返回 null", () => {
    localStorage.setItem(NEWSLETTER_STORAGE_KEY, "{garbage");
    expect(readNewsletter()).toBeNull();
  });

  it("读到非邮箱时清掉并返回 null", () => {
    localStorage.setItem(
      NEWSLETTER_STORAGE_KEY,
      JSON.stringify({ email: "not-an-email", recordedAt: 1 }),
    );
    expect(readNewsletter()).toBeNull();
    expect(localStorage.getItem(NEWSLETTER_STORAGE_KEY)).toBeNull();
  });

  it("exportNewsletter 返回 JSON 字符串", () => {
    saveNewsletter("e@f.g", 1_700_000_000_000);
    const out = exportNewsletter();
    expect(out).not.toBeNull();
    expect(JSON.parse(out!).email).toBe("e@f.g");
  });
});
