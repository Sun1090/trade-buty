import { describe, expect, it } from "vitest";
import { parsePlanBody } from "./route";

describe("parsePlanBody (R7.12)", () => {
  it("接受合法请求并规范化空白", () => {
    expect(
      parsePlanBody({
        doneChapters: [" getting-started ", "spot"],
        wrongChapters: ["futures"],
        currentChapter: " technical-analysis ",
      }),
    ).toEqual({
      doneChapters: ["getting-started", "spot"],
      wrongChapters: ["futures"],
      currentChapter: "technical-analysis",
    });
  });

  it("缺省章节字段时回落为空数组/空字符串", () => {
    expect(parsePlanBody({})).toEqual({
      doneChapters: [],
      wrongChapters: [],
      currentChapter: "",
    });
  });

  it("拒绝非数组、非字符串元素与超长 slug", () => {
    expect(parsePlanBody(null)).toBeNull();
    expect(parsePlanBody({ doneChapters: "spot" })).toBeNull();
    expect(parsePlanBody({ wrongChapters: [1] })).toBeNull();
    expect(parsePlanBody({ doneChapters: ["x".repeat(65)] })).toBeNull();
    expect(parsePlanBody({ currentChapter: 5 })).toBeNull();
  });

  it("限制拼进 prompt 的章节数量", () => {
    const many = Array.from({ length: 65 }, (_, i) => `c${i}`);
    expect(parsePlanBody({ doneChapters: many })).toBeNull();
    expect(parsePlanBody({ doneChapters: many.slice(0, 64) })).not.toBeNull();
  });
});
