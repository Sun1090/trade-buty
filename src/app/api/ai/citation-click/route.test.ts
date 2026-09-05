import { describe, it, expect } from "vitest";
import { parseCitationClick } from "./route";

describe("parseCitationClick", () => {
  it("合法 source 点击返回规范化字段", () => {
    const out = parseCitationClick({
      kind: "source",
      chapter: "spot",
      doc: "order-types",
      question: "什么是市价单？",
    });
    expect(out).toEqual({
      kind: "source",
      chapter: "spot",
      doc: "order-types",
      question: "什么是市价单？",
    });
  });

  it("suggested 点击无 doc 也合法", () => {
    expect(parseCitationClick({ kind: "suggested", chapter: "futures" })).toEqual({
      kind: "suggested",
      chapter: "futures",
      doc: undefined,
      question: undefined,
    });
  });

  it("非法 kind / 空 chapter / 非对象返回 null", () => {
    expect(parseCitationClick({ kind: "click", chapter: "spot" })).toBeNull();
    expect(parseCitationClick({ kind: "source", chapter: "  " })).toBeNull();
    expect(parseCitationClick(null)).toBeNull();
    expect(parseCitationClick("x")).toBeNull();
  });

  it("chapter 超长拒绝；doc/question 超长截断", () => {
    expect(parseCitationClick({ kind: "source", chapter: "a".repeat(101) })).toBeNull();
    const out = parseCitationClick({
      kind: "source",
      chapter: "spot",
      doc: "d".repeat(300),
      question: "q".repeat(600),
    });
    expect(out?.doc).toHaveLength(200);
    expect(out?.question).toHaveLength(500);
  });
});
