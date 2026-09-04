import { describe, it, expect } from "vitest";
import { parseExportQuery } from "./route";

describe("parseExportQuery", () => {
  it("默认值：limit 100，无过滤", () => {
    expect(parseExportQuery(new URLSearchParams())).toEqual({
      rating: undefined,
      limit: 100,
      since: undefined,
    });
  });

  it("合法参数透传", () => {
    const q = parseExportQuery(
      new URLSearchParams("rating=unhelpful&limit=20&since=2026-01-01")
    );
    expect(q).toEqual({ rating: "unhelpful", limit: 20, since: "2026-01-01" });
  });

  it("非法 rating 被丢弃", () => {
    expect(parseExportQuery(new URLSearchParams("rating=meh")).rating).toBeUndefined();
  });

  it("limit 上限 500，下限回退 100", () => {
    expect(parseExportQuery(new URLSearchParams("limit=9999")).limit).toBe(500);
    expect(parseExportQuery(new URLSearchParams("limit=-3")).limit).toBe(100);
    expect(parseExportQuery(new URLSearchParams("limit=abc")).limit).toBe(100);
  });

  it("非法日期被丢弃", () => {
    expect(parseExportQuery(new URLSearchParams("since=not-a-date")).since).toBeUndefined();
  });
});
