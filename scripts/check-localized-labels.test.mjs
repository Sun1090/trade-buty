import { describe, expect, it } from "vitest";
import { join } from "node:path";
import {
  findUnlocalizedLabels,
  LOCALE_FREE_SURFACES,
  scanSource,
} from "./check-localized-labels.mjs";

describe("check:localized-labels（R16.50 / R16.51）", () => {
  it("抓到写死中文的属性值", () => {
    expect(scanSource(`<button title="语速" aria-label='停止'>x</button>`)).toEqual([
      { line: 1, kind: "attr", where: "title", value: "语速" },
      { line: 1, kind: "attr", where: "aria-label", value: "停止" },
    ]);
  });

  it("抓到写死中文的 JSX 文本节点", () => {
    const hits = scanSource(`<button>\n  随机抽题重答\n</button>`);
    expect(hits).toEqual([{ line: 2, kind: "text", where: "JSX 文本", value: "随机抽题重答" }]);
  });

  it("放过按 locale 分支的写法：表达式里的两种语言都不算裸文本", () => {
    expect(
      scanSource(
        `<button title={rateLabel}>{locale === "en" ? "Back" : "返回"}</button>` +
          `<span>{locale === "en" ? "Random redo" : "随机抽题重答"}</span>`,
      ),
    ).toEqual([]);
  });

  it("放过纯符号文本与注释里的示例", () => {
    expect(scanSource(`<span>→</span>\n{/* 例：title="语速" */}\n// placeholder="朗读"`)).toEqual([]);
  });

  it("源码树当下干净（这条抓的是新增回归）", () => {
    expect(findUnlocalizedLabels(join(process.cwd(), "src"))).toEqual([]);
  });

  it("豁免清单只放拿不到 locale 的表面", () => {
    // 每加一条豁免就等于放弃一处检查，所以先钉住它现在只有这三处
    expect(LOCALE_FREE_SURFACES).toEqual([
      join("src", "app", "not-found.tsx"),
      join("src", "app", "error.tsx"),
      join("src", "app", "share", "[kind]", "[path]", "opengraph-image.tsx"),
    ]);
  });
});
