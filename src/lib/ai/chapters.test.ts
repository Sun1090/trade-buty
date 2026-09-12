import { describe, it, expect } from "vitest";
import { getChapterTitle } from "./chapters";

describe("getChapterTitle", () => {
  it("去掉标题的 `NN · ` 前缀", () => {
    expect(getChapterTitle("zh", "behavioral-finance")).toBe("行为金融篇");
  });

  it("未知章节返回 null", () => {
    expect(getChapterTitle("zh", "no-such-chapter")).toBeNull();
  });

  it("未知 locale 返回 null", () => {
    expect(getChapterTitle("fr", "behavioral-finance")).toBeNull();
  });
});
