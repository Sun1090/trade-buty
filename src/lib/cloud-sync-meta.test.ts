// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearLastCloudSync, getLastCloudSync, recordCloudSync } from "./cloud-sync-meta";

const store = new Map<string, string>();
const dispatchSpy = vi.fn();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
});
vi.stubGlobal("window", { dispatchEvent: dispatchSpy });

describe("cloud sync meta", () => {
  beforeEach(() => {
    store.clear();
    dispatchSpy.mockClear();
  });

  it("returns null when nothing was synced yet", () => {
    expect(getLastCloudSync()).toBeNull();
  });

  it("records the sync time and broadcasts", () => {
    recordCloudSync(1_700_000_000_000);
    expect(getLastCloudSync()).toBe(1_700_000_000_000);
    expect(dispatchSpy.mock.calls[0][0].type).toBe("tb-cloud-sync");
  });

  it("falls back to now for invalid timestamps and tolerates corrupt storage", () => {
    recordCloudSync(Number.NaN);
    const recorded = getLastCloudSync();
    expect(recorded).not.toBeNull();
    expect(recorded!).toBeGreaterThan(0);
    store.set("tb-last-cloud-sync", "not-a-number");
    expect(getLastCloudSync()).toBeNull();
    store.set("tb-last-cloud-sync", "-5");
    expect(getLastCloudSync()).toBeNull();
  });

  it("clearLastCloudSync removes the marker", () => {
    recordCloudSync(123);
    clearLastCloudSync();
    expect(getLastCloudSync()).toBeNull();
  });
});
