import { expect, test } from "@playwright/test";

/**
 * `src/app/globals.css` 那段注释写着「打印友好」，所以打印（或存成 PDF）就是本站
 * 承诺的一种读法。实测（Chromium + `emulateMedia({ media: "print" })`）打的却是一页
 * 缺标题、盖着侧栏与浮动目录按钮的课文：
 *
 * - 打印规则整条隐藏 `<header>`，而课文标题的 `<h1>` 就住在页面自己的 hero `<header>`
 *   里（`knowledge/[chapter]/[doc]/page.tsx`）——站点顶栏和课文标题被同一条规则一起吞了；
 * - 固定侧栏（`learning-sidebar.tsx` 的 `<aside>`）、篇章进度栏、☰ 目录浮钮都不在
 *   `header/nav/footer` 的选择器里，于是原样印在正文上。
 *
 * 这里按「印出来的那一页应该有什么」逐条钉住，而不是去钉 CSS 的写法。
 */
const LESSONS = [
  "/zh/knowledge/getting-started/core-concepts",
  "/en/knowledge/getting-started/core-concepts",
];

test.describe("打印课文页", () => {
  for (const path of LESSONS) {
    test(`${path}：标题与正文在纸上，浏览器外壳与浮钮不在`, async ({ page }) => {
      await page.goto(path);
      await page.emulateMedia({ media: "print" });

      const h1 = page.locator("header h1");
      await expect(h1, "课文标题必须印得出来（它曾经被整条 header 隐藏规则一起吞掉）").toBeVisible();
      await expect(page.locator("article"), "正文必须印得出来").toBeVisible();
      // 内容宪法要求每一篇课文都带风险警示：打印的那一份也不能只剩正文
      await expect(
        page.getByText(/不构成任何投资建议|not.*investment advice/i).first(),
        "这一页印出来必须带着风险警示"
      ).toBeVisible();

      for (const [name, locator] of [
        ["站点顶栏", page.locator("body > header")],
        ["页脚", page.locator("footer")],
        ["固定侧栏", page.locator("aside.fixed")],
        ["☰ 目录浮钮", page.locator("div.fixed.right-4.bottom-20")],
        ["课文工具条上的「朗读」", page.getByRole("button", { name: "朗读" })],
        ["课文工具条上的「复制链接」", page.getByRole("button", { name: /复制链接|Copy link/ })],
      ] as const) {
        await expect(locator, `${name}不该印在课文上`).toBeHidden();
      }
    });
  }
});
