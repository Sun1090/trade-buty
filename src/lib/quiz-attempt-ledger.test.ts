import { beforeEach, describe, expect, it } from "vitest";
import { readQuizAttemptLedger, writeQuizAttempt } from "./quiz-attempt-ledger";

class MapStorage implements Storage {
  private store = new Map<string, string>();
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
  removeItem(key: string) { this.store.delete(key); }
  clear() { this.store.clear(); }
  key(index: number) { return [...this.store.keys()][index] ?? null; }
  get length() { return this.store.size; }
}

describe("quiz attempt ledger", () => {
  let storage: MapStorage;
  beforeEach(() => { storage = new MapStorage(); });

  it("appends timestamped attempts without overwriting previous attempts", () => {
    writeQuizAttempt(storage, "getting-started", 5, 10, 123);
    writeQuizAttempt(storage, "getting-started", 8, 10, 456);
    expect(readQuizAttemptLedger(storage)).toEqual({
      "getting-started:123": { chapter: "getting-started", best: 5, total: 10, at: 123 },
      "getting-started:456": { chapter: "getting-started", best: 8, total: 10, at: 456 },
    });
  });

  it("clamps impossible scores and replaces an unusable timestamp", () => {
    writeQuizAttempt(storage, "getting-started", -2, 0, Number.NaN);
    const ledger = readQuizAttemptLedger(storage);
    // 时间戳坏到不能用时退回「现在」：这一条确实刚刚发生过，丢掉才是假账
    expect(Object.keys(ledger)).toHaveLength(1);
    const entry = Object.values(ledger)[0];
    expect(entry).toEqual({ chapter: "getting-started", best: 0, total: 1, at: expect.any(Number) });
    expect(entry.at).toBeGreaterThan(0);
  });

  it("keeps the first write for a same-timestamp retry", () => {
    writeQuizAttempt(storage, "getting-started", 4, 10, 123);
    writeQuizAttempt(storage, "getting-started", 8, 10, 123);

    expect(readQuizAttemptLedger(storage)).toEqual({
      "getting-started:123": { chapter: "getting-started", best: 4, total: 10, at: 123 },
    });
  });

  // 0 分是一套做完了的测验，不是「没有记录」：不写它，统计页的「测验次数」就少一次，
  // 而同一页概览卡的「测验完成」照样把它算进去。
  it("records a zero-score completion", () => {
    writeQuizAttempt(storage, "getting-started", 0, 10, 456);

    expect(readQuizAttemptLedger(storage)).toEqual({
      "getting-started:456": { chapter: "getting-started", best: 0, total: 10, at: 456 },
    });
  });
});
