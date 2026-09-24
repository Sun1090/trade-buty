import { describe, expect, it } from "vitest";
import {
  EN_CJK_MAX_RATIO,
  EN_VS_ZH_MIN_LENGTH_RATIO,
  countCjkChars,
  findEnContentViolations,
  formatPercent,
  measureEnContent,
  stripFrontmatter,
} from "./en-content-lib.mjs";

const DOC = "---\ntitle: 01 · Demo\ndescription: d\n---\n";

function measure(enBody, zhBody) {
  const enFiles = new Map([["demo/a.md", enBody]]);
  const zhFiles = new Map(zhBody === undefined ? [] : [["demo/a.md", zhBody]]);
  return measureEnContent({ enFiles, zhFiles });
}

function onlyRow(measured) {
  const [row] = measured.rows;
  return row;
}

describe("stripFrontmatter", () => {
  it("去掉开头的 YAML 块，保留正文", () => {
    expect(stripFrontmatter(`${DOC}# Body`)).toBe("# Body");
  });

  it("没有 frontmatter 时原样返回", () => {
    expect(stripFrontmatter("# Body")).toBe("# Body");
  });

  it("正文中间的分隔线不算 frontmatter，不许把整篇吃掉", () => {
    expect(stripFrontmatter("# Body\n\n---\n\nTail")).toBe("# Body\n\n---\n\nTail");
  });
});

describe("countCjkChars", () => {
  it("数汉字、假名与谚文，不数中文标点", () => {
    expect(countCjkChars("「止损」 stop loss とかガン")).toBe(6);
  });

  it("拉丁字母与数字一个都不算", () => {
    expect(countCjkChars("BTC is 20,000 USD — a line.")).toBe(0);
  });
});

describe("measureEnContent", () => {
  it("给出逐文件行数，并指出最高 CJK 占比与最短长度比落在哪个文件", () => {
    const measured = measureEnContent({
      enFiles: new Map([
        ["a.md", `${DOC}plain english`],
        ["b.md", `${DOC}英文 english`],
      ]),
      zhFiles: new Map([
        ["a.md", `${DOC}中文中文中文`],
        ["b.md", `${DOC}中文中文中文`],
      ]),
    });
    expect(measured.summary).toMatchObject({
      enFiles: 2,
      zhFiles: 2,
      unpairedEnFiles: 0,
      emptyEnFiles: 0,
      highestCjkFile: "b.md",
      lowestLengthFile: "b.md",
    });
    expect(measured.summary.highestCjkRatio).toBeCloseTo(2 / 10, 10);
  });

  it("正文字数按码点计，长度比也按码点计", () => {
    const measured = measure(`${DOC}😀😀😀`, `${DOC}中文中文`);
    expect(onlyRow(measured).chars).toBe(3);
    expect(measured.summary.lowestLengthRatio).toBeCloseTo(3 / 4, 10);
  });

  it("找不到同名中文的文件仍量 CJK，只是不参与长度比", () => {
    const measured = measure(`${DOC}english only`);
    expect(onlyRow(measured).lengthRatio).toBeNull();
    expect(measured.summary.unpairedEnFiles).toBe(1);
  });

  it("空正文不除零：占比记 0，另由 emptyEnFiles 计数", () => {
    const measured = measure(DOC, `${DOC}中文`);
    expect(onlyRow(measured).cjkRatio).toBe(0);
    expect(measured.summary.emptyEnFiles).toBe(1);
  });
});

describe("findEnContentViolations", () => {
  it("CJK 占比超上界判 cjk-ratio，没超就不判", () => {
    const over = measure(`${DOC}english ${"a".repeat(20)}${"汉".repeat(6)}`);
    expect(onlyRow(over).cjkRatio).toBeGreaterThan(EN_CJK_MAX_RATIO);
    expect(findEnContentViolations(over)).toEqual([
      { key: "demo/a.md", kind: "cjk-ratio", detail: expect.stringContaining("CJK 占比") },
    ]);
    const under = measure(`${DOC}english ${"a".repeat(60)}汉`);
    expect(onlyRow(under).cjkRatio).toBeLessThanOrEqual(EN_CJK_MAX_RATIO);
    expect(findEnContentViolations(under)).toEqual([]);
  });

  it("正文短到低于下界判 thin，缺同名中文时不作此断言", () => {
    const thin = measure(`${DOC}ab`, `${DOC}${"中".repeat(100)}`);
    expect(findEnContentViolations(thin)).toEqual([
      { key: "demo/a.md", kind: "thin", detail: expect.stringContaining("正文长度") },
    ]);
    expect(findEnContentViolations(measure(`${DOC}ab`))).toEqual([]);
  });

  it("空正文只判 empty，不再叠加占比与长度两类", () => {
    const empty = measure(DOC, `${DOC}${"中".repeat(100)}`);
    expect(findEnContentViolations(empty)).toEqual([
      { key: "demo/a.md", kind: "empty", detail: expect.any(String) },
    ]);
  });

  it("阈值方向：长度下界小于 1（英文本就更长），占比上界是个正的小数", () => {
    expect(EN_VS_ZH_MIN_LENGTH_RATIO).toBeLessThan(1);
    expect(EN_CJK_MAX_RATIO).toBeGreaterThan(0);
  });
});

describe("formatPercent", () => {
  it("一位小数的百分比", () => {
    expect(formatPercent(0.02)).toBe("2%");
    expect(formatPercent(0.5249)).toBe("52.5%");
  });
});
