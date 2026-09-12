import { beforeEach, describe, expect, it } from "vitest";
import { readReviewAttemptLedger, writeReviewAttempt } from "./review-attempt-ledger";

class MapStorage implements Storage {
  private store = new Map<string, string>();
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
  removeItem(key: string) { this.store.delete(key); }
  clear() { this.store.clear(); }
  key(index: number) { return [...this.store.keys()][index] ?? null; }
  get length() { return this.store.size; }
}

describe("review attempt ledger", () => {
  let storage: MapStorage;
  beforeEach(() => { storage = new MapStorage(); });

  it("appends review answers without overwriting different questions or timestamps", () => {
    writeReviewAttempt(storage, "getting-started", 0, true, false, 1, 123);
    writeReviewAttempt(storage, "getting-started", 0, false, false, 0, 456);
    writeReviewAttempt(storage, "spot", 2, true, true, 4, 789);
    expect(readReviewAttemptLedger(storage)).toEqual({
      "getting-started:0:123": { chapter: "getting-started", questionIdx: 0, correct: true, mastered: false, stage: 1, at: 123 },
      "getting-started:0:456": { chapter: "getting-started", questionIdx: 0, correct: false, mastered: false, stage: 0, at: 456 },
      "spot:2:789": { chapter: "spot", questionIdx: 2, correct: true, mastered: true, stage: 4, at: 789 },
    });
  });

  it("is idempotent for the same question at the same timestamp", () => {
    writeReviewAttempt(storage, "getting-started", 0, true, false, 1, 123);
    writeReviewAttempt(storage, "getting-started", 0, false, false, 0, 123);
    expect(Object.keys(readReviewAttemptLedger(storage))).toHaveLength(1);
    expect(readReviewAttemptLedger(storage)["getting-started:0:123"].correct).toBe(true);
  });

  it("rejects empty chapters and negative question indexes", () => {
    writeReviewAttempt(storage, "", 0, true, false, 1, 123);
    writeReviewAttempt(storage, "  ", 1, true, false, 1, 123);
    writeReviewAttempt(storage, "spot", -1, true, false, 1, 123);
    writeReviewAttempt(storage, "spot", Number.NaN, true, false, 1, 123);
    expect(readReviewAttemptLedger(storage)).toEqual({});
  });

  it("tolerates corrupt stored JSON", () => {
    storage.setItem("tb-review-attempts", "not-json{");
    expect(readReviewAttemptLedger(storage)).toEqual({});
    writeReviewAttempt(storage, "spot", 0, true, false, 1, 123);
    expect(Object.keys(readReviewAttemptLedger(storage))).toHaveLength(1);
  });

  it("caps the ledger at 300 entries, keeping the newest", () => {
    for (let i = 1; i <= 310; i++) {
      writeReviewAttempt(storage, "spot", i, true, false, 1, i);
    }
    const ledger = readReviewAttemptLedger(storage);
    expect(Object.keys(ledger)).toHaveLength(300);
    // 最旧的 10 条已被裁剪，最新的保留
    expect(ledger["spot:1:1"]).toBeUndefined();
    expect(ledger["spot:310:310"]).toMatchObject({ questionIdx: 310 });
  });
});
