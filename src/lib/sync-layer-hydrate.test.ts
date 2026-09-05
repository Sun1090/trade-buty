// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mergeWrongbook } from "./sync-layer";
import type { WrongEntry } from "./wrongbook";

// 内存 localStorage（jsdom 30 opaque origin）
const memStore = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => memStore.get(k) ?? null,
  setItem: (k: string, v: string) => memStore.set(k, v),
  removeItem: (k: string) => memStore.delete(k),
  clear: () => memStore.clear(),
  key: () => null,
  length: 0,
};
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// supabase client mock（hoist 到顶层，hydrateFromCloud 静态依赖）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockProgressSelect: any = vi.fn(async () => ({ data: null }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockProgressUpsert: any = vi.fn(async () => ({ data: null }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockWrongSelect: any = vi.fn(async () => ({ data: null }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockQuizSelect: any = vi.fn(async () => ({ data: null }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockReplaySelect: any = vi.fn(async () => ({ data: null }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockBestSelect: any = vi.fn(async () => ({ data: [] }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSettingsSelect: any = vi.fn(async () => ({ data: [] }));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowser: () => ({
    from: (table: string) => {
      if (table === "progress") {
        return {
          select: () => ({ eq: () => mockProgressSelect() }),
          upsert: (...args: unknown[]) => mockProgressUpsert(...args),
        };
      }
      if (table === "wrongbook") {
        return { select: () => ({ eq: () => mockWrongSelect() }) };
      }
      if (table === "quiz_scores") {
        return { select: () => ({ eq: () => mockQuizSelect() }) };
      }
      if (table === "replay_history") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => mockReplaySelect(),
              }),
            }),
          }),
        };
      }
      if (table === "replay_best") {
        return { select: () => ({ eq: () => mockBestSelect() }) };
      }
      if (table === "user_settings") {
        return { select: () => ({ eq: () => mockSettingsSelect() }) };
      }
      throw new Error("unexpected table: " + table);
    },
  }),
}));

beforeEach(() => {
  memStore.clear();
  mockProgressSelect.mockReset();
  mockProgressUpsert.mockReset();
  mockWrongSelect.mockReset();
  mockQuizSelect.mockReset();
  mockReplaySelect.mockReset();
  mockBestSelect.mockReset();
  mockSettingsSelect.mockReset();
  // 缺省空响应
  mockProgressSelect.mockResolvedValue({ data: null });
  mockProgressUpsert.mockResolvedValue({ data: null });
  mockWrongSelect.mockResolvedValue({ data: null });
  mockQuizSelect.mockResolvedValue({ data: null });
  mockReplaySelect.mockResolvedValue({ data: null });
  mockBestSelect.mockResolvedValue({ data: [] });
  mockSettingsSelect.mockResolvedValue({ data: [] });
});

// ============================================================
// mergeWrongbook SRS 字段测试
// ============================================================
describe("mergeWrongbook — SRS 字段合并", () => {
  it("云端 SRS 字段写入新条目", () => {
    const out = mergeWrongbook({}, [
      {
        chapter_num: "ch1",
        question_idx: 0,
        picked: 2,
        answered_at: "2026-01-01T00:00:00Z",
        srs_stage: 3,
        srs_due: "2026-01-05",
      },
    ]);
    expect(out["ch1:0"]).toMatchObject({
      srsStage: 3,
      srsDue: "2026-01-05",
    });
  });

  it("云端 srs_stage/srs_due 为 null 时不覆盖本地已有 SRS 计划", () => {
    const local: Record<string, WrongEntry> = {
      "ch1:0": {
        chapterNum: "ch1",
        questionIdx: 0,
        picked: 1,
        at: 946684800000,
        srsStage: 5,
        srsDue: "2026-02-01",
      },
    };
    const out = mergeWrongbook(local, [
      {
        chapter_num: "ch1",
        question_idx: 0,
        picked: 2,
        answered_at: "2026-01-01T00:00:00Z",
        srs_stage: null,
        srs_due: null,
      },
    ]);
    expect(out["ch1:0"].picked).toBe(2);
    expect(out["ch1:0"].srsStage).toBe(5);
    expect(out["ch1:0"].srsDue).toBe("2026-02-01");
  });

  it("云端 SRS 有值时覆盖本地（云端较新）", () => {
    const local: Record<string, WrongEntry> = {
      "ch1:0": {
        chapterNum: "ch1",
        questionIdx: 0,
        picked: 1,
        at: 946684800000,
        srsStage: 2,
        srsDue: "2026-01-10",
      },
    };
    const out = mergeWrongbook(local, [
      {
        chapter_num: "ch1",
        question_idx: 0,
        picked: 1,
        answered_at: "2026-01-01T00:00:00Z",
        srs_stage: 4,
        srs_due: "2026-01-15",
      },
    ]);
    expect(out["ch1:0"].srsStage).toBe(4);
    expect(out["ch1:0"].srsDue).toBe("2026-01-15");
  });

  it("本地无 SRS 字段时云端 null 不引入 undefined vs null 混淆", () => {
    const local: Record<string, WrongEntry> = {
      "ch1:0": {
        chapterNum: "ch1",
        questionIdx: 0,
        picked: 1,
        at: 946684800000,
      },
    };
    const out = mergeWrongbook(local, [
      {
        chapter_num: "ch1",
        question_idx: 0,
        picked: 2,
        answered_at: "2026-01-01T00:00:00Z",
      },
    ]);
    expect(out["ch1:0"].picked).toBe(2);
    expect(out["ch1:0"].srsStage).toBeUndefined();
  });
});

// ============================================================
// hydrateFromCloud 端到端
// ============================================================
describe("hydrateFromCloud", () => {
  it("空 cloud 数据：不写 localStorage、不抛错、仍 dispatch 一次", async () => {
    const { hydrateFromCloud } = await import("./sync-layer");
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    await hydrateFromCloud("user-123");
    expect(memStore.has("tb-progress")).toBe(false);
    expect(mockProgressUpsert).not.toHaveBeenCalled();
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "tb-progress" }));
  });

  it("cloud progress → 合并后写回 localStorage", async () => {
    memStore.set("tb-progress", JSON.stringify({ "getting-started": ["doc-a"] }));
    mockProgressSelect.mockResolvedValueOnce({
      data: [
        { chapter_num: "getting-started", doc_slug: "doc-a" },
        { chapter_num: "getting-started", doc_slug: "doc-b" },
        { chapter_num: "futures", doc_slug: "margin" },
      ],
    });
    const { hydrateFromCloud } = await import("./sync-layer");
    await hydrateFromCloud("user-123");
    const merged = JSON.parse(memStore.get("tb-progress")!);
    expect(merged["getting-started"].sort()).toEqual(["doc-a", "doc-b"]);
    expect(merged["futures"]).toEqual(["margin"]);
  });

  it("本地有 cloud 没有：补传到云端 (ignoreDuplicates true)", async () => {
    memStore.set("tb-progress", JSON.stringify({ ch1: ["doc-a", "doc-b"] }));
    mockProgressSelect.mockResolvedValueOnce({
      data: [{ chapter_num: "ch1", doc_slug: "doc-a" }],
    });
    const { hydrateFromCloud } = await import("./sync-layer");
    await hydrateFromCloud("user-123");
    expect(mockProgressUpsert).toHaveBeenCalledTimes(1);
    const [rows, opts] = mockProgressUpsert.mock.calls[0]!;
    expect(rows).toEqual([
      { user_id: "user-123", chapter_num: "ch1", doc_slug: "doc-a" },
      { user_id: "user-123", chapter_num: "ch1", doc_slug: "doc-b" },
    ]);
    expect(opts).toMatchObject({ ignoreDuplicates: true });
  });

  it("cloud wrongbook → 写回 localStorage（合并本地+云端）", async () => {
    memStore.set(
      "tb-wrong",
      JSON.stringify({
        "ch1:0": { chapterNum: "ch1", questionIdx: 0, picked: 1, at: 946684800000 },
      }),
    );
    mockWrongSelect.mockResolvedValueOnce({
      data: [
        {
          chapter_num: "ch1",
          question_idx: 0,
          picked: 2,
          answered_at: "2026-01-01T00:00:00Z",
        },
      ],
    });
    const { hydrateFromCloud } = await import("./sync-layer");
    await hydrateFromCloud("user-123");
    const merged = JSON.parse(memStore.get("tb-wrong")!);
    expect(merged["ch1:0"].picked).toBe(2);
  });

  it("cloud quiz_scores → 写回每个 chapter", async () => {
    mockQuizSelect.mockResolvedValueOnce({
      data: [
        { chapter_num: "ch1", best: 9, total: 10, done: true },
        { chapter_num: "ch2", best: 5, total: 10, done: true },
      ],
    });
    const { hydrateFromCloud } = await import("./sync-layer");
    await hydrateFromCloud("user-123");
    expect(JSON.parse(memStore.get("tb-quiz-ch1")!)).toEqual({ best: 9, done: true });
    expect(JSON.parse(memStore.get("tb-quiz-ch2")!)).toEqual({ best: 5, done: true });
  });

  it("cloud replay_best → 取 max 写入 localStorage", async () => {
    memStore.set("tb-replay-best", "5");
    mockBestSelect.mockResolvedValueOnce({ data: [{ best_streak: 12 }] });
    const { hydrateFromCloud } = await import("./sync-layer");
    await hydrateFromCloud("user-123");
    expect(memStore.get("tb-replay-best")).toBe("12");
  });

  it("本地已有 daily_goal 时，云端 goal 不覆盖（本地优先）", async () => {
    memStore.set("tb-daily-goal-min", "20");
    mockSettingsSelect.mockResolvedValueOnce({ data: [{ daily_goal_min: 30 }] });
    const { hydrateFromCloud } = await import("./sync-layer");
    await hydrateFromCloud("user-123");
    expect(memStore.get("tb-daily-goal-min")).toBe("20");
  });

  it("本地无 daily_goal 时，云端 goal 写入", async () => {
    mockSettingsSelect.mockResolvedValueOnce({ data: [{ daily_goal_min: 30 }] });
    const { hydrateFromCloud } = await import("./sync-layer");
    await hydrateFromCloud("user-123");
    expect(memStore.get("tb-daily-goal-min")).toBe("30");
  });

  it("任一表 query reject 时整体降级，不抛、不写一半", async () => {
    mockProgressSelect.mockRejectedValueOnce(new Error("network down"));
    const { hydrateFromCloud } = await import("./sync-layer");
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    await expect(hydrateFromCloud("user-123")).resolves.toBeUndefined();
    // 整体仍 dispatch 一次（Promise.all 抛错但被 try/catch 包裹）
    expect(dispatchSpy).toHaveBeenCalled();
  });

  it("空 id 直接 return，不发起任何 supabase 请求", async () => {
    const { hydrateFromCloud } = await import("./sync-layer");
    await hydrateFromCloud("");
    expect(mockProgressSelect).not.toHaveBeenCalled();
    expect(mockWrongSelect).not.toHaveBeenCalled();
    expect(mockQuizSelect).not.toHaveBeenCalled();
    expect(mockReplaySelect).not.toHaveBeenCalled();
    expect(mockBestSelect).not.toHaveBeenCalled();
    expect(mockSettingsSelect).not.toHaveBeenCalled();
  });
});
