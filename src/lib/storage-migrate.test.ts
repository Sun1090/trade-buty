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
};
vi.stubGlobal("localStorage", localStorageMock);

const { migrateStorage } = await import("./storage-migrate");

describe("storage-migrate", () => {
  beforeEach(() => store.clear());

  it("空存储不报错，设迁移标记", () => {
    migrateStorage();
    expect(store.get("tb-migrated-v2")).toBe("1");
  });

  it("progress 数字章节键被删除，slug 键保留", () => {
    store.set("tb-progress", JSON.stringify({ "01": ["doc-a"], "getting-started": ["doc-b"] }));
    migrateStorage();
    const p = JSON.parse(store.get("tb-progress") ?? "{}");
    expect(p["01"]).toBeUndefined();
    expect(p["getting-started"]).toEqual(["doc-b"]);
  });

  it("wrongbook 数字键条目被清除", () => {
    store.set("tb-wrong", JSON.stringify({ "01:0": { picked: 1 }, "spot:2": { picked: 3 } }));
    migrateStorage();
    const w = JSON.parse(store.get("tb-wrong") ?? "{}");
    expect(w["01:0"]).toBeUndefined();
    expect(w["spot:2"]).toBeDefined();
  });

  it("旧数字键测验成绩 tb-quiz-NN 被删除", () => {
    store.set("tb-quiz-01", JSON.stringify({ best: 5 }));
    store.set("tb-quiz-spot", JSON.stringify({ best: 7 }));
    migrateStorage();
    expect(store.has("tb-quiz-01")).toBe(false);
    expect(store.has("tb-quiz-spot")).toBe(true);
  });

  it("progress 损坏 JSON 被清除", () => {
    store.set("tb-progress", "{broken json");
    migrateStorage();
    expect(store.has("tb-progress")).toBe(false);
  });

  it("幂等：已迁移过直接返回，不重复处理", () => {
    store.set("tb-migrated-v2", "1");
    store.set("tb-progress", JSON.stringify({ "01": ["doc-a"] }));
    migrateStorage();
    // 数字键未被清理（因为已迁移，直接 return）
    const p = JSON.parse(store.get("tb-progress") ?? "{}");
    expect(p["01"]).toBeDefined();
  });
});
