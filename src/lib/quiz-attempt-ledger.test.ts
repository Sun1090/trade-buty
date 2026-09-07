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

  it("sanitizes timestamps and does not store zero-score attempts", () => {
    writeQuizAttempt(storage, "getting-started", -2, 0, Number.NaN);
    expect(readQuizAttemptLedger(storage)).toEqual({});
  });

  it("ignores duplicate same-timestamp writes and zero-score attempts", () => {
    writeQuizAttempt(storage, "getting-started", 4, 10, 123);
    writeQuizAttempt(storage, "getting-started", 8, 10, 123);
    writeQuizAttempt(storage, "getting-started", 0, 10, 456);

    expect(readQuizAttemptLedger(storage)).toEqual({
      "getting-started:123": { chapter: "getting-started", best: 4, total: 10, at: 123 },
    });
  });
});
