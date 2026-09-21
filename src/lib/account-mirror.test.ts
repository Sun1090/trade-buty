// @vitest-environment jsdom
/**
 * 本地镜像归属（共享浏览器换账号）：`tb-*` 是按设备存的，换账号时如果不钉归属，
 * `hydrateFromCloud` 会把上一个账号的镜像并进当前账号并补传到当前账号的云平行。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MIRROR_OWNER_KEY,
  adoptAccountMirror,
  getMirrorOwner,
  resetAccountMirror,
} from "./account-mirror";

const memStore = new Map<string, string>();
const storage = {
  getItem: (k: string) => memStore.get(k) ?? null,
  setItem: (k: string, v: string) => void memStore.set(k, String(v)),
  removeItem: (k: string) => void memStore.delete(k),
  clear: () => memStore.clear(),
  key: (i: number) => [...memStore.keys()][i] ?? null,
  get length() {
    return memStore.size;
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: storage,
  writable: true,
});

/** 换账号后必须消失的镜像；设备偏好与本地独有记录必须留下 */
function seedMirror() {
  memStore.set("tb-progress", JSON.stringify({ spot: ["risk"] }));
  memStore.set("tb-progress-completions", JSON.stringify({ "spot:risk": { at: 1 } }));
  memStore.set("tb-wrong", JSON.stringify({ "spot:0": { picked: 1 } }));
  memStore.set("tb-quiz-spot", JSON.stringify({ best: 9, done: true }));
  memStore.set("tb-replay-history", "[]");
  memStore.set("tb-replay-best", "7");
  memStore.set("tb-daily-goal-min", "30");
  memStore.set("tb-daily-goal-date", "2026-09-22");
  memStore.set("tb-weekly-goal-min", "150");
  memStore.set("tb-sync-conflicts", JSON.stringify({ at: 1, items: [] }));
  memStore.set("tb-last-cloud-sync", "123");
  // 不该被动到的两类：设备偏好 + 云端没有对应表的本地记录
  memStore.set("tb-theme", "dark");
  memStore.set("tb-quiz-difficulty", "2");
  memStore.set("tb-bookmarks", "[]");
  memStore.set("tb-streak", JSON.stringify({ days: 3 }));
}

beforeEach(() => {
  memStore.clear();
});

describe("adoptAccountMirror", () => {
  it("游客镜像没有归属戳时由第一个登录的账号认领，且不清数据", () => {
    memStore.set("tb-progress", JSON.stringify({ "getting-started": ["intro"] }));
    memStore.set("tb-theme", "dark");

    adoptAccountMirror("user-a");

    expect(getMirrorOwner()).toBe("user-a");
    expect(JSON.parse(memStore.get("tb-progress")!)).toEqual({
      "getting-started": ["intro"],
    });
  });

  it("同一账号重复设置状态（令牌刷新、重新挂载）完全幂等", () => {
    seedMirror();
    adoptAccountMirror("user-a");
    const before = new Map(memStore);

    adoptAccountMirror("user-a");
    adoptAccountMirror("user-a");

    expect(getMirrorOwner()).toBe("user-a");
    expect(new Map(memStore)).toEqual(before);
  });

  it("换账号时丢掉上一账号的镜像，但保留设备偏好与本地独有记录", () => {
    seedMirror();
    adoptAccountMirror("user-a");
    expect(getMirrorOwner()).toBe("user-a");

    adoptAccountMirror("user-b");

    expect(getMirrorOwner()).toBe("user-b");
    for (const key of [
      "tb-progress",
      "tb-progress-completions",
      "tb-wrong",
      "tb-quiz-spot",
      "tb-replay-history",
      "tb-replay-best",
      "tb-daily-goal-min",
      "tb-daily-goal-date",
      "tb-weekly-goal-min",
      "tb-sync-conflicts",
      "tb-last-cloud-sync",
    ]) {
      expect(memStore.has(key), `${key} 属于上一个账号，必须清掉`).toBe(false);
    }
    expect(memStore.get("tb-theme")).toBe("dark");
    expect(memStore.get("tb-quiz-difficulty")).toBe("2");
    expect(memStore.get("tb-bookmarks")).toBe("[]");
    expect(memStore.get("tb-streak")).toBe(JSON.stringify({ days: 3 }));
  });

  it("同前缀的设备偏好 tb-quiz-difficulty 不会被当成每章成绩清掉", () => {
    memStore.set("tb-quiz-difficulty", "1");
    memStore.set(MIRROR_OWNER_KEY, "user-a");
    adoptAccountMirror("user-b");
    expect(memStore.get("tb-quiz-difficulty")).toBe("1");
  });

  it("空 userId 不做任何事（未登录 / 未知身份）", () => {
    seedMirror();
    adoptAccountMirror("");
    expect(getMirrorOwner()).toBeNull();
    expect(memStore.has("tb-progress")).toBe(true);
  });
});

describe("resetAccountMirror", () => {
  it("清除镜像连同归属戳，让下一个账号从干净状态开始", () => {
    seedMirror();
    adoptAccountMirror("user-a");
    resetAccountMirror();
    expect(getMirrorOwner()).toBeNull();
    expect(memStore.has("tb-progress")).toBe(false);
    expect(memStore.get("tb-theme")).toBe("dark");
  });

  it("localStorage 抛错时静默降级，不打断调用方", () => {
    const broken = {
      ...storage,
      getItem: vi.fn(() => {
        throw new Error("SecurityError");
      }),
      removeItem: vi.fn(() => {
        throw new Error("SecurityError");
      }),
      setItem: vi.fn(() => {
        throw new Error("QuotaExceeded");
      }),
      key: () => null,
      length: 0,
    };
    Object.defineProperty(globalThis, "localStorage", { value: broken, writable: true });
    try {
      expect(() => adoptAccountMirror("user-c")).not.toThrow();
      expect(() => resetAccountMirror()).not.toThrow();
      expect(getMirrorOwner()).toBeNull();
    } finally {
      Object.defineProperty(globalThis, "localStorage", { value: storage, writable: true });
    }
  });
});
