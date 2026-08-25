import { describe, it, expect, beforeEach, vi } from "vitest";

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() {
    return store.size;
  },
  clear: () => store.clear(),
};
vi.stubGlobal("localStorage", localStorageMock);

const dataset: Record<string, string> = {};
const eventListeners: Record<string, (() => void)[]> = {};
vi.stubGlobal("document", {
  documentElement: { dataset },
});
vi.stubGlobal("window", {
  dispatchEvent: () => {},
  addEventListener: (type: string, fn: () => void) => {
    eventListeners[type] = eventListeners[type] || [];
    eventListeners[type].push(fn);
  },
  removeEventListener: () => {},
});

const { getTheme, setTheme } = await import("./theme");

describe("theme", () => {
  beforeEach(() => {
    store.clear();
    for (const k of Object.keys(dataset)) delete dataset[k];
  });

  it("默认 dark", () => {
    expect(getTheme()).toBe("dark");
  });

  it("setTheme light", () => {
    setTheme("light");
    expect(getTheme()).toBe("light");
    expect(dataset.theme).toBe("light");
  });

  it("setTheme sepia", () => {
    setTheme("sepia");
    expect(getTheme()).toBe("sepia");
  });

  it("setTheme dark", () => {
    setTheme("dark");
    expect(getTheme()).toBe("dark");
  });
});
