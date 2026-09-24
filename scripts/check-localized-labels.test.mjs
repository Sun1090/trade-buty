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

  it("抓到按 locale 分支的写法之外的第三种形状：属性表达式里的对象字面量", () => {
    // 图表页的全屏按钮：<FullscreenToggle label={{ enter: "全屏", exit: "退出" }} />
    // 值不是引号属性、也不是 >…< 之间的裸文字，前两类规则套不上，中文就这么原样印到了英文页上。
    expect(
      scanSource(`<FullscreenToggle targetId="c" label={{ enter: "全屏", exit: "退出" }} />`),
    ).toEqual([
      { line: 1, kind: "attrExpr", where: "label={…}", value: "全屏" },
      { line: 1, kind: "attrExpr", where: "label={…}", value: "退出" },
    ]);
  });

  it("属性表达式换行也抓得到（表达式按花括号配平取，不按行取）", () => {
    const hits = scanSource(
      `<FullscreenToggle\n  label={{\n    enter: "全屏",\n  }}\n/>`,
    );
    expect(hits).toEqual([{ line: 3, kind: "attrExpr", where: "label={…}", value: "全屏" }]);
  });

  it("放过紧邻配对的两种写法：别名是 en 还是 locale 都不管，认的是有没有另一种说法", () => {
    expect(scanSource(`<HeroCard title={en ? "Calendar" : "日历"} label={locale === "zh" ? "术语表" : "Glossary"} />`)).toEqual([]);
  });

  it("一半一半的对象只报中文那条：判据是逐处配对，不是整段有没有英文", () => {
    expect(scanSource(`<Card labels={{ share: "Share", preview: "预览卡面" }} />`)).toEqual([
      { line: 1, kind: "attrExpr", where: "labels={…}", value: "预览卡面" },
    ]);
  });

  it("花括号没配平的表达式宁可放过，也不猜半截", () => {
    expect(scanSource(`<Broken label={{ enter: "全屏"`)).toEqual([]);
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
