/**
 * R16.241：`docs/growth-copy-policy.md` 对自己的说法负责。
 *
 * 这份政策是增长文案的红线，也是别人判断「一个增长入口能不能上」的依据；它一旦把
 * 表面数、用例数、登记表的键、召回提示的天数说错，读者就会按一个不存在的口径评审。
 * 所以这里的所有判据都从产物现读：登记表 JSON、门禁脚本、门禁用例、中英文典、
 * `src/lib/last-visit.ts` 的常量。文档里的数字与引号只能是抄件。
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  collectStringLiterals,
  extractEntries,
  extractLocaleBlock,
  extractSection,
} from "./check-dark-pattern-copy.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const doc = read("docs/growth-copy-policy.md");
const inventory = JSON.parse(read("src/lib/growth-surfaces.json"));
const gateSrc = read("scripts/check-dark-pattern-copy.mjs");
const caseSrc = read("scripts/check-dark-pattern-copy.test.mjs");
const i18nSrc = read("src/lib/i18n.ts");
const lastVisitSrc = read("src/lib/last-visit.ts");

/** 中文正文会为了排版折行，比对前先抹掉所有空白。 */
const flat = (s) => s.replace(/\s+/g, "");

/** 取文档里某个二级标题下的正文（到下一个二级标题为止）。 */
function section(head) {
  const start = doc.indexOf(`## ${head}`);
  expect(start, `docs/growth-copy-policy.md 里没有「## ${head}」这一节`).toBeGreaterThanOrEqual(0);
  const rest = doc.slice(start);
  const next = rest.indexOf("\n## ", 3);
  return next === -1 ? rest : rest.slice(0, next);
}

/** 抓「- `名字`：…」这类条目行开头反引号里的名字（允许一行写两个）。 */
function bulletNames(text) {
  const names = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("- ")) continue;
    const headOfLine = line.slice(2).split("：")[0];
    for (const m of headOfLine.matchAll(/`([^`]+)`/g)) names.push(m[1]);
  }
  return names;
}

/** 抓正文里所有「…」引号里的原话。 */
function quotes(text) {
  return [...text.matchAll(/「([^」]+)」/g)].map((m) => m[1]);
}

const surfaces = inventory.surfaces;

describe("政策文档登记的键与表面数就是 JSON 本身", () => {
  const listedKeys = bulletNames(section("表面登记表"));

  it("键清单不多不少正好是 JSON 里出现过的全部键", () => {
    const actual = new Set();
    for (const s of surfaces) for (const k of Object.keys(s)) actual.add(k);
    expect(listedKeys.length, "登记表那一节没解析出任何条目行").toBeGreaterThanOrEqual(actual.size);
    expect(new Set(listedKeys), `文档列的键与登记表不一致（JSON 是 ${[...actual].join("、")}）`)
      .toEqual(actual);
    expect(listedKeys.length, "键清单里有重复项").toBe(new Set(listedKeys).size);
    expect(flat(section("表面登记表")), `正文那句「下面 N 个键」数错了（JSON 里是 ${actual.size} 个）`)
      .toContain(`下面${actual.size}个键`);
  });

  it("只有两条表面用了收窄键，文档点名的就是它们", () => {
    const byKey = (field) => surfaces.filter((s) => s[field] != null).map((s) => s.id);
    const claimed = (field) => {
      const line = section("表面登记表").split("\n").find((l) => l.startsWith(`- \`${field}\``));
      expect(line, `登记表那一节里没有 \`-${field}\` 那一条`).toBeTruthy();
      return [...line.matchAll(/当前只有 `([^`]+)` 用到/g)].map((m) => m[1]);
    };
    expect(byKey("keyPrefix")).toEqual(["return-nudge"]);
    expect(claimed("keyPrefix"), "文档说谁用 keyPrefix，说错了").toEqual(["return-nudge"]);
    expect(byKey("i18nSource")).toEqual(["milestone-share"]);
    expect(claimed("i18nSource"), "文档说谁用 i18nSource，说错了").toEqual(["milestone-share"]);
    const alt = surfaces.find((s) => s.i18nSource);
    expect(existsSync(path.join(root, alt.i18nSource)), `i18nSource 指向的 ${alt.i18nSource} 不存在`).toBe(true);
    expect(doc, "文档没写出那份替代字典的路径").toContain(alt.i18nSource);
  });

  it("blocking / requiresDismiss / optIn 的计数与取值都对得上", () => {
    const body = flat(section("表面登记表"));
    const falses = surfaces.filter((s) => s.blocking === false).length;
    const dismiss = surfaces.filter((s) => s.requiresDismiss === true).length;
    const optInTrue = surfaces.filter((s) => s.optIn === true);
    const optInFalse = surfaces.filter((s) => s.optIn !== true).length;

    expect(surfaces.length).toBeGreaterThanOrEqual(6);
    expect(falses, "有表面把 blocking 写成了 true，文档那句「全部为 false」已经不实").toBe(surfaces.length);
    expect(body).toContain(`登记表中${surfaces.length}个表面全部为\`false\``);
    expect(body).toContain(`声明为\`true\`的表面有${dismiss}个`);
    expect(body).toContain(`${optInTrue.length}个为\`true\``);
    expect(body).toContain(`${optInFalse}个为\`false\``);
    expect(
      [...new Set(optInTrue.map((s) => s.kind))].sort(),
      "optIn 为 true 的表面已经超出「安装、订阅、分享」三类，文档那句得改",
    ).toEqual(["newsletter", "pwa-install", "sharing"]);
  });

  it("文档说「门禁不读 optIn」，门禁就真的没读它", () => {
    expect(doc).toContain("**门禁不读这一项**");
    expect(gateSrc, "门禁脚本现在读起了 optIn，文档那句「只是登记事实」已经不实").not.toMatch(/\boptIn\b/);
    expect(caseSrc.replace(/^.*optIn: (true|false),?$/gm, ""), "门禁用例里还有断言在管 optIn")
      .not.toMatch(/\boptIn\b/);
  });
});

describe("政策文档引的每一句界面话都真的印在界面上", () => {
  const zhInstall = extractEntries(
    extractSection(extractLocaleBlock(i18nSrc, "zh"), "install"),
  );
  const label = (entries) => collectStringLiterals(entries ?? "")[0] ?? "";

  it("安装提示那颗按钮的文案，文档抄的是字典里的原话", () => {
    const zh = label(zhInstall.dismiss);
    expect(zh, "中英文典里没读到 install.dismiss").not.toBe("");
    const en = label(
      extractEntries(extractSection(extractLocaleBlock(i18nSrc, "en"), "install")).dismiss,
    );
    expect(en, "install.dismiss 缺英文").not.toBe("");
    const promise = flat(section("关闭与选择权的具体约定"));
    expect(promise, `文档里的安装提示按钮不叫「${zh}」了，得同步`)
      .toContain(`点「${zh}」或走完原生安装选择后写入本机标记`);
    const retired = /所以它不叫「([^」]+)」/.exec(doc);
    expect(retired, "文档那句「它不叫 X」没了着落").toBeTruthy();
    expect(zh, "按钮现在就叫那个它说自己不叫的名字").not.toBe(retired[1]);
    const promptSrc = read("src/components/install-prompt.tsx");
    expect(promptSrc, "安装提示已经不是靠浏览器事件出现了").toContain("beforeinstallprompt");
  });

  it("邀请 banner 的「清除」入口、邮件订阅的占位与导出都真实存在", () => {
    const invite = read(surfaces.find((s) => s.id === "invite-banner").component);
    const promise = flat(section("关闭与选择权的具体约定"));
    expect(promise, "文档说有「清除」入口，登记表里的邀请组件却找不着").toContain("另有「清除」入口");
    expect(invite, "邀请 banner 没有清除入口").toContain("清除");
    expect(invite, "邀请 banner 的清除入口没做英文").toContain("Clear");
    expect(invite, "「清除」并没有真的清掉本机邀请状态").toContain("clearInvite");

    const zhNewsletter = extractEntries(
      extractSection(extractLocaleBlock(i18nSrc, "zh"), "newsletter"),
    );
    expect(flat(zhNewsletter.title), "邮件订阅标题不再标注占位").toContain("占位");
    expect(flat(zhNewsletter.desc), "订阅说明不再写「站内没有邮件服务」").toContain("占位功能");
    expect(Object.keys(zhNewsletter), "订阅条目少了「清除」或「复制 JSON」").toEqual(
      expect.arrayContaining(["clear", "copy", "exportLabel"]),
    );
  });

  it("「允许的表达」里每条引号都是字典原文，不是想当然的示范句", () => {
    const body = section("允许的表达")
      .split("\n")
      .filter((l) => l.startsWith("- "))
      .join("\n");
    const found = quotes(body);
    expect(found.length, "这一节一条例子都没了，扫描不能空转").toBeGreaterThanOrEqual(8);
    const dict = flat(i18nSrc);
    for (const q of found) {
      expect(dict, `「${q}」这句界面里从来没有印过`).toContain(flat(q));
    }
  });
});

describe("政策文档里的数字、路径与编号都能在仓库里查到", () => {
  it("召回提示的两个天数读自 last-visit 的常量", () => {
    const days = Number(/RETURN_NUDGE_INTERVAL_MS\s*=\s*(\d+)\s*\*\s*24/.exec(lastVisitSrc)?.[1]);
    const ceiling = Number(/now - lastVisitAt > (\d+) \* 24 \* 60 \* 60 \* 1000/.exec(lastVisitSrc)?.[1]);
    expect(days, "没读到 RETURN_NUDGE_INTERVAL_MS").toBeGreaterThan(0);
    expect(ceiling, "没读到那条上限天数").toBeGreaterThan(days);
    const promise = flat(section("关闭与选择权的具体约定"));
    expect(promise, `文档说的门槛天数不是常量里的 ${days}`).toContain(`距上次访问满${days}天`);
    expect(promise, `文档没交代超过 ${ceiling} 天就不弹这件事`).toContain(`没超过${ceiling}天`);
    expect(promise, `文档说的提示间隔不是常量里的 ${days}`).toContain(`至少间隔${days}天`);
    expect(promise, "文档没写出这两个天数的出处文件").toContain("src/lib/last-visit.ts");
  });

  it("验收证据里的表面数、豁免数与用例数是现读的", () => {
    const body = flat(section("验收证据"));
    expect(surfaces.length).toBeGreaterThanOrEqual(6);
    expect(inventory.unregisteredAllowed.length).toBeGreaterThanOrEqual(4);
    const cases = (caseSrc.match(/^\s*it\(/gm) ?? []).length;
    expect(cases, "门禁用例少到不正常，扫描八成没跑起来").toBeGreaterThanOrEqual(20);
    expect(body, `文档写的登记表面数不是 ${surfaces.length}`).toContain(`覆盖${surfaces.length}个登记表面`);
    expect(body, `文档写的豁免数不是 ${inventory.unregisteredAllowed.length}`)
      .toContain(`与${inventory.unregisteredAllowed.length}条豁免`);
    expect(body, `文档写的用例数不是 ${cases}`).toContain(`${cases}个用例`);
  });

  it("硬性规则表点名的门禁实现真的存在", () => {
    const exported = new Set(
      [...gateSrc.matchAll(/^export (?:const|function)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]),
    );
    const manifestKeys = new Set();
    for (const s of surfaces) for (const k of Object.keys(s)) manifestKeys.add(k);
    const cells = doc
      .split("\n")
      .filter((l) => l.startsWith("| ") && !l.startsWith("| #") && !l.startsWith("|---"))
      .map((l) => l.split("|")[3] ?? "");
    expect(cells.length, "硬性规则表没解析出任何一行").toBeGreaterThanOrEqual(8);
    const named = cells.flatMap((cell) => [...cell.matchAll(/`([A-Za-z_$][\w$]*)`/g)].map((m) => m[1]))
      .filter((n) => n !== "true" && n !== "false");
    expect(named.length).toBeGreaterThanOrEqual(5);
    for (const n of new Set(named)) {
      expect(
        exported.has(n) || manifestKeys.has(n),
        `规则表指着 \`${n}\`，可它既不是门禁脚本的导出、也不是登记表的字段`,
      ).toBe(true);
    }
  });

  it("文档点名的路径与 R 编号都查得到", () => {
    const paths = [...doc.matchAll(/`((?:src|scripts|docs|\.github)\/[^`]+)`/g)].map((m) => m[1]);
    expect(paths.length, "文档一个路径都没提到").toBeGreaterThanOrEqual(6);
    for (const p of new Set(paths)) {
      expect(existsSync(path.join(root, p)), `文档指着 ${p}，仓库里没有这个文件`).toBe(true);
    }
    const roadmap = read("docs/roadmap.md");
    const ids = [...new Set([...doc.matchAll(/\bR\d+\.\d+\b/g)].map((m) => m[0]))];
    expect(ids.length, "文档不再引用任何 roadmap 编号了").toBeGreaterThanOrEqual(4);
    for (const id of ids) {
      expect(roadmap, `文档引用的 ${id} 在 roadmap 里查无此项`).toContain(id);
    }
  });
});
