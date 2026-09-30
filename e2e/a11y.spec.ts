import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

/**
 * 全站 a11y 回归门禁（axe-core，R16.281）。
 *
 * 2026-09-30 用 AxeBuilder 对 20 条关键页做过一次全规则扫描，量出并修掉了四类真实
 * 违规（1 critical / 1 serious / 2 moderate）：
 * - `aria-valid-attr-value`（critical）：搜索框的 aria-controls 在建议列表未打开时
 *   指向不存在的 id——读屏拿到悬空引用；
 * - `nested-interactive`（serious）：图表容器的 role="img" 包着错误态「重试」按钮；
 * - `landmark-unique`（moderate ×2）：header 导航、篇章/课文面包屑、学习侧栏 aside
 *   没有可区分的 landmark 名。
 * 本 spec 把这三条规则钉在同样的关键页面上：任何新代码把同类问题带回来，都红在这里。
 * 规则范围刻意只含这三条——其他规则（对比度走 e2e/light-contrast，region 这类
 * 争议规则）要么已有专属门禁、要么未经逐条 triage，先不放进硬门禁。
 */

const PAGES = [
  "/zh",
  "/en",
  "/zh/path",
  "/en/path",
  "/zh/chart",
  "/en/chart",
  "/zh/replay",
  "/zh/review",
  "/zh/stats",
  "/zh/auth",
  "/zh/search",
  "/en/search",
  "/zh/ai",
  "/zh/bookmarks",
  "/zh/knowledge/getting-started",
  "/en/knowledge/getting-started",
  "/zh/knowledge/getting-started/candlestick-basics",
  "/zh/glossary",
  "/zh/about",
  "/zh/calendar",
];

/** 本门禁负责的三条规则：都有真实读屏/键盘受害者的那一类 */
const RULES = ["aria-valid-attr-value", "nested-interactive", "landmark-unique"];

for (const path of PAGES) {
  test(`a11y（axe）：${path} 无三类已知违规`, async ({ page }) => {
    await page.goto(path, { waitUntil: "load" });
    // 给水合一个完成窗口：landmark 修正与 aria-controls 都发生在客户端渲染后
    await page.waitForTimeout(500);
    const res = await new AxeBuilder({ page })
      .disableRules(["region"])
      .withRules(RULES)
      .analyze();
    const summary = res.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
      sample: v.nodes[0]?.target.join(" "),
      help: v.help,
    }));
    expect(
      summary,
      `${path} 出现 a11y 违规：修复它，而不是放宽 RULES——新增规则要先逐条 triage`
    ).toEqual([]);
  });
}
