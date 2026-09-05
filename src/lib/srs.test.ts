import { describe, it, expect } from "vitest";
import {
  EBBINGHAUS_INTERVALS,
  srsOnAnswer,
  isSrsDue,
  isSrsOverdue,
  backfillSrs,
  effectiveSrs,
  daysUntilDue,
} from "./srs";

const T = "2026-09-05";

describe("R5.1 间隔表", () => {
  it("默认艾宾浩斯档位 1/3/7/14/30 天", () => {
    expect([...EBBINGHAUS_INTERVALS]).toEqual([1, 3, 7, 14, 30]);
  });
});

describe("R5.5 状态机", () => {
  it("新条目/答错 → stage0，明天到期", () => {
    expect(srsOnAnswer(null, false, T)).toEqual({ stage: 0, due: "2026-09-06", last: T });
    expect(srsOnAnswer({ stage: 3, due: "2026-09-05" }, false, T)).toEqual({
      stage: 0,
      due: "2026-09-06",
      last: T,
    });
  });

  it("答对按间隔表推进：stage1 → 3 天后", () => {
    expect(srsOnAnswer({ stage: 1, due: T }, true, T)).toEqual({
      stage: 2,
      due: "2026-09-12", // 1/3/7 → intervals[2]=7
      last: T,
    });
  });

  it("走完最后一档答对 → mastered", () => {
    expect(srsOnAnswer({ stage: 4, due: T }, true, T)).toBe("mastered");
  });

  it("无状态答对从 stage0 起步", () => {
    expect(srsOnAnswer(null, true, T)).toEqual({ stage: 1, due: "2026-09-08", last: T });
  });
});

describe("R5.2/R5.4 到期与过期", () => {
  it("due ≤ 今天即到期（含当天）", () => {
    expect(isSrsDue("2026-09-05", T)).toBe(true);
    expect(isSrsDue("2026-09-04", T)).toBe(true);
    expect(isSrsDue("2026-09-06", T)).toBe(false);
  });

  it("无日期视为到期（旧数据回填入口）", () => {
    expect(isSrsDue(undefined, T)).toBe(true);
  });

  it("过期 = due < 今天；无日期不标红", () => {
    expect(isSrsOverdue("2026-09-04", T)).toBe(true);
    expect(isSrsOverdue("2026-09-05", T)).toBe(false);
    expect(isSrsOverdue(undefined, T)).toBe(false);
  });

  it("daysUntilDue：负数为过期天数", () => {
    expect(daysUntilDue("2026-09-07", T)).toBe(2);
    expect(daysUntilDue("2026-09-03", T)).toBe(-2);
  });
});

describe("R5.6 旧数据回填", () => {
  it("按入库时间 +1 天推算到期日", () => {
    // 2026-09-01T10:00 入库 → due = 09-02
    const at = new Date(2026, 8, 1, 10, 0, 0).getTime();
    expect(backfillSrs(at, T)).toEqual({ stage: 0, due: "2026-09-02" });
  });

  it("effectiveSrs：有字段用字段，无字段回填", () => {
    expect(effectiveSrs({ at: 0, srsStage: 2, srsDue: "2026-09-10" }, T)).toEqual({
      stage: 2,
      due: "2026-09-10",
    });
    const at = new Date(2026, 8, 1, 10, 0, 0).getTime();
    expect(effectiveSrs({ at }, T).due).toBe("2026-09-02");
  });
});
