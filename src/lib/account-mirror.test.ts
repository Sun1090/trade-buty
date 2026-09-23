// @vitest-environment jsdom
/**
 * 本地镜像归属（共享浏览器换账号）：`tb-*` 是按设备存的，换账号时如果不钉归属，
 * `hydrateFromCloud` 会把上一个账号的镜像并进当前账号并补传到当前账号的云平行。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  PER_CHAPTER_QUIZ_EXCLUSIONS,
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

/**
 * 答题账本与每章成绩同前缀（`tb-quiz-`），却是云端没有对应表的本地独有记录：
 * 换账号清掉它，测验分数趋势就永久少一段，而且无从恢复。
 */
const QUIZ_ATTEMPTS_LEDGER = JSON.stringify({
  "spot:1": { chapter: "spot", best: 9, total: 10, at: 1 },
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
  memStore.set("tb-quiz-attempts", QUIZ_ATTEMPTS_LEDGER);
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
    expect(memStore.get("tb-quiz-attempts")).toBe(QUIZ_ATTEMPTS_LEDGER);
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

/**
 * `tb-quiz-` 这个前缀下同时住着两类东西：属于账号镜像的每章成绩，和云端没有对应表的
 * 本地独有记录。前者换账号必须清、后者清掉就是真丢数据，而 `startsWith` 分不开它们——
 * `tb-quiz-attempts` 就是这么被扫走过一次的（R16.46）。
 * 所以除名单必须跟着库房走：生产代码里每多一个写死的 `tb-quiz-xxx` 键，这里就得红一次，
 * 逼着写字的人当场回答「这个键归谁」。
 */
describe("tb-quiz- 前缀下的键必须逐条定性", () => {
  const KEY_LITERAL = /"tb-quiz-[a-z][a-z0-9-]*"/g;

  function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) sourceFiles(full, out);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  const found = new Set<string>();
  for (const file of sourceFiles(path.join(process.cwd(), "src"))) {
    for (const match of fs.readFileSync(file, "utf8").matchAll(KEY_LITERAL)) {
      found.add(match[0].replaceAll('"', ""));
    }
  }

  it("扫描本身扫得到东西（防止正则空转）", () => {
    expect(found.size, "一个 `tb-quiz-` 字面量键都没扫到，说明扫描写坏了").toBeGreaterThan(0);
  });

  it("每个写死的键都已经在除名单上", () => {
    expect([...found].sort()).toEqual([...PER_CHAPTER_QUIZ_EXCLUSIONS].sort());
  });
});
