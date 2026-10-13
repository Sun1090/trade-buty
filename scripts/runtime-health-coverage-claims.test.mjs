/**
 * R16.333：「哪些页面在水合巡检里被量过」不许由一份手抄清单决定——清单的主人必须是源码树。
 *
 * 病灶：`e2e/runtime-health.spec.ts` 的 `ROUTES` 是一份字面量清单，而它测的是**这一类**缺陷
 * 唯一的探测器：单测跑 jsdom、移动门禁只量布局，「服务端 HTML 与水合首帧对不上」只在
 * 真浏览器的生产产物里才浮出来（文件头记着 2026-09-22 那次抓到四处）。清单外新增一页，
 * 就永远没有水合探测，而且**没有任何东西会红**。
 *
 * 这一族已经咬过三次：R16.329（两条移动门禁合起来漏 10 页）、R16.330（AI 端点清单只有 4/8）、
 * R16.331（课文级未知 URL 生产 500，而用例名承诺的形状比断言覆盖的宽）。本轮先做证伪实验：
 * 把缺的 5 个模板临时补进 ROUTES 跑一遍——**38 条全绿，没有红出新缺陷**（`.gate-logs/`）。
 * 所以这一笔不是「修 bug」，是给一条本来就没主人的路补上主人：漏页的代价要由门禁承担，
 * 而不是等下一个人在某次临时探针里顺手发现。
 *
 * 口径与 `mobile-coverage-claims` 共用 `page-template-coverage-lib.mjs` 那把尺子：
 * 两条门禁各自规定「谁必须被盖到」，但「有哪些页面」「怎么算盖到」只有一份定义。
 * 分两份写就会漂（R16.333 之前 `matches()` 真的在两个文件里各抄了一遍）。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  diffTemplateCoverage,
  listPageTemplates,
  nonPathLiterals,
  readLocalesFromI18n,
  readRouteLiterals,
  stripLocale,
} from "./page-template-coverage-lib.mjs";

const root = process.cwd();
const SPEC = "e2e/runtime-health.spec.ts";
const specSrc = readFileSync(path.join(root, SPEC), "utf8");
const TEMPLATES = listPageTemplates(root);
const LOCALES = readLocalesFromI18n(root);

/** 水合巡检的两族清单：只加载不点，和点遍按钮。两族合起来才算「这页被量过」。 */
function routesFrom(name) {
  const literals = readRouteLiterals(specSrc, name);
  expect(literals, `${SPEC} 里找不到 const ${name} = [...]：这一族清单换了形状，门禁要重新对齐`).toBeTruthy();
  const foreign = nonPathLiterals(literals);
  expect(
    foreign,
    `${SPEC} 的 ${name} 里混进了不像路径的条目：${foreign.join(", ")}——解析器越界会把无关字面量读成路由，覆盖面就此虚报`,
  ).toEqual([]);
  return literals.map((route) => stripLocale(route, LOCALES));
}

const hydration = routesFrom("ROUTES");
const clicked = routesFrom("CLICK_ROUTES");
const covered = [...new Set([...hydration, ...clicked])];

describe("水合巡检的页面清单由源码树说了算", () => {
  it("扫描本身不是空转（模板数与两族清单长度都有地板）", () => {
    expect(TEMPLATES.length, `只数到 ${TEMPLATES.length} 份页面模板，扫描本身坏了`).toBeGreaterThanOrEqual(20);
    expect(hydration.length, "ROUTES 解析出的条目太少").toBeGreaterThanOrEqual(20);
    expect(clicked.length, "CLICK_ROUTES 解析出的条目太少").toBeGreaterThanOrEqual(6);
  });

  it("两族清单的并集覆盖每一个页面模板（新增页面不许没有水合探测）", () => {
    const { missing } = diffTemplateCoverage({ templates: TEMPLATES, routes: covered });
    expect(
      missing,
      `这些页面模板从没被水合巡检量过：${missing.join(", ")}——把一条具体 URL 加进 ROUTES（或 CLICK_ROUTES），` +
        "不要留着清单不补：这一类缺陷只有这一族探测器能抓到",
    ).toEqual([]);
  });

  it("清单里不许留着已经没有 page.tsx 的路径（不许只长不消）", () => {
    const { stale } = diffTemplateCoverage({ templates: TEMPLATES, routes: covered });
    expect(
      stale,
      `两族清单点名了没有对应 page.tsx 的路径：${stale.join(", ")}——那条用例量的其实是 404 页，永远不会红`,
    ).toEqual([]);
  });

  it("正向对照：探测器抓得出假路径，也抓得出漏掉的模板（自证）", () => {
    // 「不许只长不消」那条腿的探测器：少一条就成空转
    const withGhost = [...covered, "/does-not-exist-anywhere"];
    const { stale } = diffTemplateCoverage({ templates: TEMPLATES, routes: withGhost });
    expect(stale, "探测器抓不出假路径，上面那条「不许只长不消」是空转").toEqual([
      "/does-not-exist-anywhere",
    ]);
    // 「漏页」那条腿：从清单里摘掉一页，必须被 missing 点名
    const minusOne = covered.filter((route) => route !== "/privacy");
    const { missing } = diffTemplateCoverage({ templates: TEMPLATES, routes: minusOne });
    expect(missing, "摘掉 /privacy 之后没人喊漏页，上面那条「覆盖每一个模板」是空转").toContain("/privacy");
  });

  it("R16.331 那类「用例名承诺的形状比断言覆盖的宽」不许复发：动态段要有具体值", () => {
    // `/knowledge/[chapter]` 与 `/knowledge/[chapter]/[doc]` 是两个模板，
    // 只量课文页不等于量过章节页——这正是本轮 5 个漏网页里 `/knowledge/[chapter]` 的成因。
    for (const template of ["/knowledge/[chapter]", "/knowledge/[chapter]/[doc]"]) {
      const hits = covered.filter((route) => {
        const want = template.split("/").filter(Boolean);
        const have = route.split("/").filter(Boolean);
        return want.length === have.length && want.every((s, i) => s.startsWith("[") || s === have[i]);
      });
      expect(hits.length, `${template} 在水合巡检里一条具体 URL 都没有`).toBeGreaterThanOrEqual(1);
    }
    // 分享落地页的载荷段必须是真载荷（畸形载荷那一支由 share-invalid-payload spec 管，不在这条射程内）
    expect(
      covered.some((route) => route.startsWith("/share/")),
      "分享落地页没有水合探测：它是最容易在载荷解析上炸的一页",
    ).toBe(true);
  });
});
