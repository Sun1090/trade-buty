import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { findUnlocalizedLabels, scanSource } from "./check-localized-labels.mjs";

describe("check:localized-labels（R16.50）", () => {
  it("抓到写死中文的 title 与 aria-label", () => {
    const hits = scanSource(
      `<button title="语速" aria-label='停止'>x</button>\n<span alt="走势图" />`,
    );
    expect(hits).toEqual([
      { line: 1, attr: "title", value: "语速" },
      { line: 1, attr: "aria-label", value: "停止" },
      { line: 2, attr: "alt", value: "走势图" },
    ]);
  });

  it("放过取自 locale 的属性：表达式与英文默认值都不算", () => {
    expect(
      scanSource(
        `<ReadAloud title={rateLabel} label={locale === "en" ? "Stop" : "停止"} placeholder="Search" />`,
      ),
    ).toEqual([]);
  });

  it("放过注释里的示例写法", () => {
    expect(scanSource(`// title="语速" 是历史上的写死例子\n * placeholder="朗读"`)).toEqual([]);
  });

  it("源码树当下干净（这条抓的是新增回归）", () => {
    expect(findUnlocalizedLabels(join(process.cwd(), "src"))).toEqual([]);
  });
});
