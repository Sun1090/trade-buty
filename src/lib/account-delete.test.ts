// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { clearLocalAccountData, requestAccountDeletion } from "./account-delete";

const store = new Map<string, string>();
const localStorageMock: Storage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, value),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
  key: (index) => Array.from(store.keys())[index] ?? null,
  get length() { return store.size; },
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, configurable: true, writable: true });

beforeEach(() => {
  store.clear();
  vi.restoreAllMocks();
});

describe("clearLocalAccountData (R9.10)", () => {
  it("clears tb-* data including the persisted queue", () => {
    store.set("tb-progress", "x");
    store.set("tb-sync-queue", "x");
    store.set("tb-sync-queue-next-id", "2");
    store.set("extension-data", "keep");
    clearLocalAccountData();
    expect(store.has("tb-progress")).toBe(false);
    expect(store.has("tb-sync-queue")).toBe(false);
    expect(store.has("tb-sync-queue-next-id")).toBe(false);
    expect(store.get("extension-data")).toBe("keep");
  });
});

describe("requestAccountDeletion (R9.10)", () => {
  it("uses DELETE and accepts a successful response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await expect(requestAccountDeletion()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/delete", {
      method: "DELETE",
      credentials: "include",
    });
  });

  it("rejects failed responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "not authenticated" }), { status: 401 }),
    );
    await expect(requestAccountDeletion()).rejects.toThrow("not authenticated");
  });

  it("rejects malformed responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("oops", { status: 200 }),
    );
    await expect(requestAccountDeletion()).rejects.toThrow("account deletion failed");
  });
});
