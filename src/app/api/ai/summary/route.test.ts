import { describe, expect, it } from "vitest";
import { parseSummaryBody } from "./route";

describe("parseSummaryBody (R7.12)", () => {
  it("接受合法请求，标题缺省时回落为章节 slug", () => {
    expect(parseSummaryBody({ chapter: "spot" })).toEqual({
      chapter: "spot",
      title: "spot",
      locale: "zh",
    });
    expect(parseSummaryBody({ chapter: "spot", title: " 现货 ", locale: "en" })).toEqual({
      chapter: "spot",
      title: "现货",
      locale: "en",
    });
  });

  it("拒绝缺失/空白 chapter 与超长字段", () => {
    expect(parseSummaryBody({})).toBeNull();
    expect(parseSummaryBody({ chapter: "   " })).toBeNull();
    expect(parseSummaryBody({ chapter: "x".repeat(65) })).toBeNull();
    expect(parseSummaryBody({ chapter: "spot", title: "x".repeat(201) })).toBeNull();
    expect(parseSummaryBody(null)).toBeNull();
  });

  it("非白名单 locale 一律回落 zh", () => {
    expect(parseSummaryBody({ chapter: "spot", locale: "fr" })?.locale).toBe("zh");
  });
});
