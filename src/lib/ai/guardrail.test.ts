import { describe, it, expect } from "vitest";
import { looksLikeRecommendation, matchSensitiveRequest } from "./guardrail";

describe("matchSensitiveRequest", () => {
  it("中文荐股命中", () => {
    expect(matchSensitiveRequest("推荐一只股票吧")).toBe("stock-pick");
    expect(matchSensitiveRequest("现在买什么币好？")).toBe("stock-pick");
    expect(matchSensitiveRequest("这只代码是多少，多少钱建仓？")).toBe("stock-pick");
  });

  it("中文收益承诺命中", () => {
    expect(matchSensitiveRequest("有没有稳赚的方法？")).toBe("profit-promise");
    expect(matchSensitiveRequest("这个币能涨多少？")).toBe("profit-promise");
  });

  it("英文命中", () => {
    expect(matchSensitiveRequest("Which stock should I buy?")).toBe("stock-pick");
    expect(matchSensitiveRequest("guaranteed profit strategy")).toBe("profit-promise");
  });

  it("正常学习问题放行", () => {
    expect(matchSensitiveRequest("什么是止损？")).toBeNull();
    expect(matchSensitiveRequest("How does leverage work?")).toBeNull();
    expect(matchSensitiveRequest("")).toBeNull();
  });

  it("超长输入截断后判定不崩", () => {
    expect(matchSensitiveRequest("止损".repeat(500))).toBeNull();
  });
});

describe("looksLikeRecommendation", () => {
  it("标的+买卖动作命中", () => {
    expect(looksLikeRecommendation("可以考虑买入 BTC，设好止损。")).toBe(true);
    expect(looksLikeRecommendation("AAPL looks good to buy now.")).toBe(true);
  });

  it("纯教学不含标的放行", () => {
    expect(looksLikeRecommendation("止损是预设的退出价格。")).toBe(false);
    expect(looksLikeRecommendation("How does leverage work?")).toBe(false);
  });
});
