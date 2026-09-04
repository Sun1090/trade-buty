import { describe, it, expect } from "vitest";
import {
  TRUNCATED_MARKER,
  hasTruncatedMarker,
  stripTruncatedMarker,
} from "./streaming";

describe("truncation marker", () => {
  it("检测流尾标记", () => {
    expect(hasTruncatedMarker("回答内容" + TRUNCATED_MARKER)).toBe(true);
    expect(hasTruncatedMarker("回答内容")).toBe(false);
    expect(hasTruncatedMarker("")).toBe(false);
  });

  it("剥离标记保留正文", () => {
    expect(stripTruncatedMarker("回答内容" + TRUNCATED_MARKER)).toBe("回答内容");
    expect(stripTruncatedMarker("干净文本")).toBe("干净文本");
  });

  it("标记在中间不算截断（只认流尾）", () => {
    expect(hasTruncatedMarker("<!--TRUNCATED--> 中间还有字")).toBe(false);
  });
});
