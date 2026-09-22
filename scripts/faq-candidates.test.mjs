import { describe, expect, it } from "vitest";
import { clusterQuestions, K_MIN_COUNT, renderReport } from "./faq-candidates.mjs";

const rows = (...questions) => questions.map((question) => ({ question }));

describe("clusterQuestions", () => {
  it("单人独条的用户原话不进公开报告：少于 k 次的问题被丢掉", () => {
    const out = clusterQuestions(
      rows("我的仓位爆了怎么办", "我的仓位爆了怎么办", "我的仓位爆了怎么办", "只有我一个人问的问题"),
    );
    expect(out).toEqual([{ question: "我的仓位爆了怎么办", count: 3 }]);
  });

  it("门槛就是导出的那个常量，不在两处各写一个数", () => {
    const q = "如何设置止损单";
    const at = rows(...Array(K_MIN_COUNT).fill(q), ...Array(K_MIN_COUNT - 1).fill("刚好差一次的问题"));
    expect(clusterQuestions(at).map((r) => r.question)).toEqual([q]);
  });

  it("大小写与首尾空白归一后计数，短于 4 字的样本忽略", () => {
    const out = clusterQuestions(rows(" RAG 是什么 ", "rag 是什么", "RAG 是什么", "嗯", "RAG 是什么"));
    expect(out).toEqual([{ question: "rag 是什么", count: 4 }]);
  });

  it("问题文本截到 80 字符，长原话不会整段外泄", () => {
    const long = "问".repeat(120);
    const out = clusterQuestions(rows(long, long, long));
    expect(out[0].question).toHaveLength(80);
  });

  it("按次数降序，同次数按文本稳定排序", () => {
    const out = clusterQuestions(
      rows("乙个问题", "乙个问题", "乙个问题", "甲个问题", "甲个问题", "甲个问题", "丙个问题", "丙个问题", "丙个问题", "丁只有一个"),
    );
    expect(out.map((r) => r.question)).toEqual(["丙个问题", "乙个问题", "甲个问题"]);
  });
});

describe("renderReport", () => {
  it("表头写明 k-匿名门槛，提醒这是公开仓库里的产物", () => {
    const md = renderReport(rows("如何做复盘", "如何做复盘", "如何做复盘"), new Date("2026-09-22T00:00:00Z"));
    expect(md).toContain("自动生成于 2026-09-22");
    expect(md).toContain(`只收录出现 ≥${K_MIN_COUNT} 次的问题`);
    expect(md).toContain("| 3 | 如何做复盘 |");
  });

  it("用户文本里的竖线被转义，不会撑破表格", () => {
    const md = renderReport(rows("a|b 是什么", "a|b 是什么", "a|b 是什么"));
    expect(md).toContain("a\\|b 是什么");
    expect(md.split("\n").find((l) => l.startsWith("| 3"))).toBe("| 3 | a\\|b 是什么 |");
  });

  it("没有达标样本时给出明确说明而不是空表", () => {
    const md = renderReport(rows("只出现一次的问题"));
    expect(md).toContain("近 30 天没有足够的 unhelpful 反馈样本");
    expect(md).not.toContain("| 次数 |");
  });
});
