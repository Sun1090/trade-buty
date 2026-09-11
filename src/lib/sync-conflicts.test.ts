// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  areSyncConflictsDismissed,
  detectMergeConflicts,
  dismissSyncConflicts,
  readSyncConflicts,
  recordSyncConflicts,
} from "./sync-conflicts";

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });
const dispatchSpy = vi.fn();
vi.stubGlobal("window", { dispatchEvent: dispatchSpy });

describe("detectMergeConflicts", () => {
  it("flags a daily goal mismatch only when both sides explicitly set values", () => {
    expect(detectMergeConflicts({ localGoalMin: 15, cloudGoalMin: 30, localWrong: {}, cloudWrong: [] })).toEqual([
      { kind: "goal", key: "daily-goal-min", local: "15", cloud: "30", resolution: "kept-local" },
    ]);
    // 本机未设置 → 云端直接采用（不是冲突）
    expect(detectMergeConflicts({ localGoalMin: null, cloudGoalMin: 30, localWrong: {}, cloudWrong: [] })).toEqual([]);
    // 一致 → 不是冲突
    expect(detectMergeConflicts({ localGoalMin: 30, cloudGoalMin: 30, localWrong: {}, cloudWrong: [] })).toEqual([]);
    // 云端未设置 → 不是冲突
    expect(detectMergeConflicts({ localGoalMin: 15, cloudGoalMin: null, localWrong: {}, cloudWrong: [] })).toEqual([]);
  });

  it("flags same-key wrongbook divergence with correct resolution direction", () => {
    const localWrong = {
      "spot:1": { at: 1000, picked: 0, srsStage: 1, srsDue: "2026-09-20" },
    };
    const newerCloud = [{
      chapter_num: "spot", question_idx: 1, picked: 2,
      answered_at: new Date(2000).toISOString(), srs_stage: 3, srs_due: "2026-09-25",
    }];
    const olderCloud = [{
      chapter_num: "spot", question_idx: 1, picked: 2,
      answered_at: new Date(500).toISOString(), srs_stage: 3, srs_due: "2026-09-25",
    }];
    expect(detectMergeConflicts({ localGoalMin: null, cloudGoalMin: null, localWrong, cloudWrong: newerCloud })).toEqual([
      { kind: "wrongbook", key: "spot:1", local: "1/2026-09-20", cloud: "3/2026-09-25", resolution: "took-cloud" },
    ]);
    expect(detectMergeConflicts({ localGoalMin: null, cloudGoalMin: null, localWrong, cloudWrong: olderCloud })).toEqual([
      { kind: "wrongbook", key: "spot:1", local: "1/2026-09-20", cloud: "3/2026-09-25", resolution: "kept-local" },
    ]);
  });

  it("ignores keys only in the cloud and identical local/cloud rows", () => {
    const localWrong = {
      "spot:1": { at: 1000, picked: 2, srsStage: 3, srsDue: "2026-09-25" },
    };
    const cloud = [
      { chapter_num: "spot", question_idx: 1, picked: 2, answered_at: new Date(1000).toISOString(), srs_stage: 3, srs_due: "2026-09-25" },
      { chapter_num: "futures", question_idx: 0, picked: 1, answered_at: new Date(1000).toISOString(), srs_stage: 0, srs_due: null },
    ];
    expect(detectMergeConflicts({ localGoalMin: null, cloudGoalMin: null, localWrong, cloudWrong: cloud })).toEqual([]);
  });
});

describe("sync conflict storage", () => {
  beforeEach(() => {
    store.clear();
    dispatchSpy.mockClear();
  });

  it("records conflicts, reads them back, and clears on empty", () => {
    const storage = localStorageMock as unknown as Storage;
    recordSyncConflicts([{ kind: "goal", key: "daily-goal-min", local: "15", cloud: "30", resolution: "kept-local" }], 1234);
    expect(readSyncConflicts(storage)).toEqual({
      at: 1234,
      items: [{ kind: "goal", key: "daily-goal-min", local: "15", cloud: "30", resolution: "kept-local" }],
    });
    expect(dispatchSpy.mock.calls.some((c) => c[0].type === "tb-sync-conflict")).toBe(true);

    recordSyncConflicts([], 2000);
    expect(readSyncConflicts(storage)).toBeNull();
  });

  it("tracks dismissal per record timestamp", () => {
    const storage = localStorageMock as unknown as Storage;
    recordSyncConflicts([{ kind: "goal", key: "k", local: "1", cloud: "2", resolution: "kept-local" }], 777);
    const record = readSyncConflicts(storage)!;
    expect(areSyncConflictsDismissed(record, storage)).toBe(false);
    dismissSyncConflicts(777);
    expect(areSyncConflictsDismissed(record, storage)).toBe(true);
    // 新一轮冲突（不同 at）需要重新提示
    recordSyncConflicts([{ kind: "goal", key: "k", local: "1", cloud: "3", resolution: "kept-local" }], 888);
    expect(areSyncConflictsDismissed(readSyncConflicts(storage), storage)).toBe(false);
  });

  it("tolerates corrupt stored JSON", () => {
    store.set("tb-sync-conflicts", "{bad json");
    expect(readSyncConflicts(localStorageMock as unknown as Storage)).toBeNull();
  });
});
