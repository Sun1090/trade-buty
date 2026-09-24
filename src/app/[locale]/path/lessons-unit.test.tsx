// @vitest-environment jsdom
/**
 * R16.55：路线页每行末尾那个 `{docCount} {lessonsUnit} →` 数的是**课文**，不是篇章。
 *
 * 英文侧一度写的是 `lessonsUnit: "chapters"`，于是同一个数字在路线页叫 chapters、在篇章页
 * 叫 lessons，而同一页别处又说全书一共 27 chapters。这里按「行尾带箭头的那一处」断言单位词，
 * 因为页面上确实存在合法的「27 chapters」（翻译进度那句话），只是它不带箭头。
 * R16.163 把中文侧同样的分家并掉：路线页写「篇」、篇章页写「课」，数的都是课文，
 * 现在两边都是「课」（`hero-name-claims.test.ts` 钉住两个字段相等）。
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

import PathPage from "./page";
import { getDict } from "@/lib/i18n";

function pathProps(locale: "zh" | "en"): PageProps<"/[locale]/path"> {
  return {
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve({}),
  };
}

async function pageText(locale: "zh" | "en"): Promise<string> {
  const view = render(
    (await PathPage(pathProps(locale))) as ReactElement,
  ) as unknown as { baseElement: HTMLElement; unmount: () => void };
  const text = view.baseElement.textContent ?? "";
  view.unmount();
  expect(text, `路线页 ${locale} 渲染为空`).not.toBe("");
  return text;
}

describe("路线页课文行的量词", () => {
  it("英文行是「NN lessons →」，不是「NN chapters →」", async () => {
    const en = await pageText("en");
    expect(en).toMatch(/\d{2} lessons →/);
    expect(en).not.toMatch(/\d{2} chapters →/);
  });

  it("中文行同样渲染出「NN 课 →」（单位词来自字典，不是写死在组件里）", async () => {
    expect(await pageText("zh")).toMatch(/\d{2} 课 →/);
  });
});

/**
 * R16.163：这一页上方的眉标以前写 `"Learning Path"`，而底部导航（`t.nav.path`）
 * 早就把同一个入口叫「学习路线」——一个界面两个名字，中文页上还整串英文。
 * 眉标现在逐字取导航那份口径；这里钉住渲染出来的确实是它。
 */
describe("路线页的眉标用导航里的名字", () => {
  /** 禁令的自证：旧写法落在眉标上时，下面那条断言抓得住 */
  it("禁令抓得住旧写法", () => {
    for (const legacy of ["Learning Path", "Practice"]) {
      expect(/[\u4e00-\u9fff]/.test(legacy), `${legacy} 本身含中文，那条断言是空转`).toBe(false);
    }
  });

  it("两种语言的眉标都等于导航里同一个入口的名字", async () => {
    for (const locale of ["zh", "en"] as const) {
      const view = render((await PathPage(pathProps(locale))) as ReactElement) as unknown as {
        container: HTMLElement;
        unmount: () => void;
      };
      const eyebrow = view.container.querySelector("header p");
      expect(eyebrow, `${locale} 这一页没有眉标那一行`).toBeTruthy();
      expect(eyebrow!.textContent, `${locale} 的眉标又和导航名字分家了`).toBe(
        getDict(locale).nav.path,
      );
      view.unmount();
    }
  });
});

/**
 * R16.155：收尾那一栏的句子说「从第一课开始」，而同一栏里唯一的按钮
 * （`page.tsx` 的 `p("/knowledge/getting-started")`，文字是「进入 01 · 入门基础篇」）
 * 打开的是**篇章页**。R16.55 那次把行尾的 `chapters` 改成 `lessons`，这一句没跟着改口，
 * 于是量词又套到了另一个对象上——同一个页面里「课」和「篇章」是两个东西（27 篇章 / 182 课）。
 */
describe("路线页收尾那句不再许访客一颗「第一课」", () => {
  const LEGACY = ["准备好了？从第一课开始。", "Ready? Start from lesson one."];

  /** 禁令的自证：旧写法必须能被下面那条断言抓住 */
  it("禁令抓得住旧写法", () => {
    for (const legacy of LEGACY) {
      expect(legacy, `旧写法本身不含「课 / lesson」，那条断言是空转`).toMatch(/课|lesson/i);
    }
  });

  it("两种语言的 readyCta 都不点名「课 / lesson」这个单位", () => {
    for (const locale of ["zh", "en"] as const) {
      expect(getDict(locale).path.readyCta, `${locale} 的 readyCta 又在说「课」`)
        .not.toMatch(/课|lesson/i);
    }
  });

  it("渲染出来时，那句旁边的按钮确实指向篇章页（不是某一篇课文）", async () => {
    const view = render((await PathPage(pathProps("zh"))) as ReactElement) as unknown as {
      container: HTMLElement;
      unmount: () => void;
    };
    const ready = getDict("zh").path.readyCta;
    const link = Array.from(view.container.querySelectorAll("a")).find(
      (a) => a.getAttribute("href") === "/zh/knowledge/getting-started",
    );
    expect(link, "那一栏的按钮不见了").toBeTruthy();
    // 篇章页的链接正好是 /zh/knowledge/<chapter>；课文页会多出一段 slug
    expect(link!.getAttribute("href")).toMatch(/^\/zh\/knowledge\/[a-z0-9-]+$/);
    const paragraph = link!.closest("div")?.textContent ?? "";
    expect(paragraph, "按钮旁边那句不是 readyCta，这条断言就白设了").toContain(ready);
    view.unmount();
  });
});
