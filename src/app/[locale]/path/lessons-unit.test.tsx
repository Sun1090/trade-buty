// @vitest-environment jsdom
/**
 * R16.55：路线页每行末尾那个 `{docCount} {lessonsUnit} →` 数的是**课文**，不是篇章。
 *
 * 英文侧一度写的是 `lessonsUnit: "chapters"`，于是同一个数字在路线页叫 chapters、在篇章页
 * 叫 lessons，而同一页别处又说全书一共 27 chapters。这里按「行尾带箭头的那一处」断言单位词，
 * 因为页面上确实存在合法的「27 chapters」（翻译进度那句话），只是它不带箭头。
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

import PathPage from "./page";

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

  it("中文行同样渲染出「NN 篇 →」（单位词来自字典，不是写死在组件里）", async () => {
    expect(await pageText("zh")).toMatch(/\d{2} 篇 →/);
  });
});
