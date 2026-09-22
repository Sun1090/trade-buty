/**
 * 隐私政策与服务条款页首行的「更新日期」。这两个页面原先写死「2026 年」，而整页是
 * 预渲染的静态 HTML——跨到下一年，这句话不会有任何人来得及改，偏偏读者正是拿它判断
 * 条款是否仍然现行。现在日期由构建期查 git 得出，查不到就整句不出现。
 * 本门禁盯两件事：写死的年份不许回来，以及「查不到」的兜底不许其实查得到（否则
 * 上面那句承诺又变回空话）。
 */
import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { lastCommitDateFor, legalPageLead } from "./legal-currency";

const PAGES = [
  "src/app/[locale]/privacy/page.tsx",
  "src/app/[locale]/terms/page.tsx",
];

/** 禁令本身要先证明自己抓得住旧写法 */
const HARDCODED_STAMP = /(更新日期|Last updated)[:：]?\s*\d{4}/;
const LEGACY = ["更新日期：2026 年", "Last updated: 2026"];

describe("法律页的「更新日期」只能来自 git", () => {
  it("禁令抓得住旧文案", () => {
    for (const sample of LEGACY) {
      expect(HARDCODED_STAMP.test(sample), `抓不住：${sample}`).toBe(true);
    }
  });

  it("两个页面都不再写死年份，且确实接在 legalPageLead 上", () => {
    for (const rel of PAGES) {
      const src = readFileSync(rel, "utf8");
      expect(HARDCODED_STAMP.test(src), `${rel} 又出现写死的年份`).toBe(false);
      expect(
        src.includes(`legalPageLead(locale, "${rel}")`),
        `${rel} 没有把日期交给 legalPageLead`,
      ).toBe(true);
    }
  });

  it("有历史的文件给出 ISO 日期，查不到时整句不出现", () => {
    const fromGit = lastCommitDateFor("package.json");
    expect(
      fromGit,
      "连 package.json 都查不到提交日期，说明探针已经失效",
    ).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(
      lastCommitDateFor("src/app/[locale]/does-not-exist/page.tsx"),
    ).toBeNull();
    // 兜底必须是「什么都不说」，而不是补一个看起来合理的年份
    expect(
      legalPageLead("zh", "src/app/[locale]/does-not-exist/page.tsx"),
    ).toBeNull();
    expect(legalPageLead("en", "package.json")).toContain(fromGit as string);
  });
});
