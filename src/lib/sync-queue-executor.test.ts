import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildQueueExecutor } from "./sync-queue-executor";
import type { QueueItem, QueueKind } from "./sync-queue";

const mocks = vi.hoisted(() => ({ getSupabaseBrowser: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowser: mocks.getSupabaseBrowser }));

interface Call {
  op: string;
  table: string;
  payload?: unknown;
  opts?: unknown;
  col?: string;
  val?: unknown;
}

let calls: Call[] = [];
let nextError: { message: string } | null = null;

function makeClient() {
  return {
    from(table: string) {
      const builder: Record<string, unknown> = {};
      builder.upsert = (payload: unknown, opts?: unknown) => {
        calls.push({ op: "upsert", table, payload, opts });
        return Promise.resolve({ error: nextError });
      };
      builder.insert = (payload: unknown) => {
        calls.push({ op: "insert", table, payload });
        return Promise.resolve({ error: nextError });
      };
      builder.delete = () => {
        calls.push({ op: "delete", table });
        return builder;
      };
      builder.eq = (col: string, val: unknown) => {
        calls.push({ op: "eq", table, col, val });
        return builder;
      };
      // 让 delete().eq().eq() 链可被 await
      builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ error: nextError }).then(resolve, reject);
      return builder;
    },
  };
}

function item(kind: QueueKind, payload: Record<string, unknown>): QueueItem {
  return { id: 1, kind, payloadKey: "k", payload, at: 0 };
}

beforeEach(() => {
  calls = [];
  nextError = null;
  mocks.getSupabaseBrowser.mockReset();
  mocks.getSupabaseBrowser.mockReturnValue(makeClient());
});

describe("buildQueueExecutor (R9.5)", () => {
  it("progress → progress 表 upsert 走三键 onConflict", async () => {
    const exec = buildQueueExecutor("user-1");
    await expect(exec(item("progress", { chapter_num: "spot", doc_slug: "order-types" }))).resolves.toBe(true);
    expect(calls).toEqual([
      {
        op: "upsert",
        table: "progress",
        payload: { user_id: "user-1", chapter_num: "spot", doc_slug: "order-types" },
        opts: { onConflict: "user_id,chapter_num,doc_slug" },
      },
    ]);
  });

  it("wrongbook-upsert 带上 srs_stage/srs_due", async () => {
    const exec = buildQueueExecutor("u");
    await exec(item("wrongbook-upsert", { chapter_num: "spot", question_idx: 2, picked: 3, srs_stage: 0, srs_due: "2026-09-14" }));
    expect(calls[0]).toMatchObject({
      op: "upsert",
      table: "wrongbook",
      opts: { onConflict: "user_id,chapter_num,question_idx" },
      payload: { user_id: "u", chapter_num: "spot", question_idx: 2, picked: 3, srs_stage: 0, srs_due: "2026-09-14" },
    });
  });

  it("wrongbook-delete 按 user/chapter/question 三条件删除", async () => {
    const exec = buildQueueExecutor("u");
    await expect(exec(item("wrongbook-delete", { chapter_num: "spot", question_idx: 7 }))).resolves.toBe(true);
    expect(calls).toEqual([
      { op: "delete", table: "wrongbook" },
      { op: "eq", table: "wrongbook", col: "user_id", val: "u" },
      { op: "eq", table: "wrongbook", col: "chapter_num", val: "spot" },
      { op: "eq", table: "wrongbook", col: "question_idx", val: 7 },
    ]);
  });

  it("quiz → quiz_scores.done 恒为 true", async () => {
    const exec = buildQueueExecutor("u");
    await exec(item("quiz", { chapter_num: "spot", best: 4, total: 5 }));
    expect(calls[0]).toMatchObject({
      op: "upsert",
      table: "quiz_scores",
      payload: { user_id: "u", chapter_num: "spot", best: 4, total: 5, done: true },
    });
  });

  it("replay-history 用 insert（多次保留）", async () => {
    const exec = buildQueueExecutor("u");
    await exec(item("replay-history", { symbol: "BTCUSDT", interval: "1h", total: 10, correct: 7, best_streak: 3 }));
    expect(calls[0]).toMatchObject({ op: "insert", table: "replay_history" });
  });

  it("replay-best → replay_best upsert onConflict user_id", async () => {
    const exec = buildQueueExecutor("u");
    await exec(item("replay-best", { best_streak: 9 }));
    expect(calls[0]).toMatchObject({
      op: "upsert",
      table: "replay_best",
      payload: { user_id: "u", best_streak: 9 },
      opts: { onConflict: "user_id" },
    });
  });

  it("goal 只带上真正提供的字段（数值判断）", async () => {
    const exec = buildQueueExecutor("u");
    await exec(item("goal", { daily_goal_min: 30 }));
    expect(calls[0]).toMatchObject({
      op: "upsert",
      table: "user_settings",
      payload: { user_id: "u", daily_goal_min: 30 },
      opts: { onConflict: "user_id" },
    });
    expect((calls[0].payload as Record<string, unknown>).weekly_goal_min).toBeUndefined();
  });

  it("数据库返回 error → false（条目保留）", async () => {
    nextError = { message: "RLS denied" };
    const exec = buildQueueExecutor("u");
    await expect(exec(item("progress", { chapter_num: "spot", doc_slug: "x" }))).resolves.toBe(false);
  });

  it("client 抛错 → false，不向外冒泡", async () => {
    mocks.getSupabaseBrowser.mockImplementation(() => {
      throw new Error("env missing");
    });
    const exec = buildQueueExecutor("u");
    await expect(exec(item("quiz", { chapter_num: "s", best: 1, total: 1 }))).resolves.toBe(false);
  });

  it("未知 kind → false", async () => {
    const exec = buildQueueExecutor("u");
    await expect(exec(item("nope" as QueueKind, {}))).resolves.toBe(false);
  });
});
