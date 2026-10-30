/**
 * R16.337：`src/app` 下 `[locale]` 之外的路由级渲染文件，归属必须有主人。
 *
 * 病灶（R16.330 登记、本轮证伪坐实）：两份认领清单（`SINGLE_LANGUAGE_FILES` 2 条、
 * `LOCALE_FREE_SURFACES` 1 条）各管各的，`src/app` 下实际有 7 份这样的文件——
 * 多出来的 4 份（根 `layout.tsx` / `loading.tsx` / `icon.tsx`、分享落地页）**没有任何
 * 清单提到它们**；清单外新增一份文件（Next 的特殊文件名就那么十来个，`global-error.tsx`
 * 这类迟早会长出来），两份清单都不会红——「这些文件归谁管」这件事没有主人。
 * 证伪实验（本轮，注入后 `npm run check:localized-labels` exit=0 全绿）：往
 * `LOCALE_FREE_SURFACES` 那张 OG 图的品牌行注入「中文 + Free neutral trading education」
 * 混搭——第一层跳过它（清单豁免）、第二层不点名它（不在清单），无人喊红。
 *
 * 为什么「显式认领」而不是先定谓词（R16.330 留的两条路，本轮选后者）：
 * 粗谓词「不在 `[locale]` 树下」推不出「拿不到 locale」——分享落地页从载荷解出
 * `getDict(locale)`，根 layout 的 init 脚本从 `location.pathname` 推 `<html lang>`，
 * 粗谓词会把真正问过语言的文件判成「该进边界清单」、把 `error.tsx` 判成不该在。
 * 所以每个文件归属哪一桶、为什么，逐条写在 `check-localized-labels.mjs` 的四份清单里：
 *
 * - `SINGLE_LANGUAGE_FILES`——拿不到 locale、渲染文字 → 只禁同页中英混搭（既有）；
 * - `LOCALE_FREE_SURFACES`——免第一层扫描，豁免的真实理由是 R16.52 待拍板的品牌行（既有）；
 * - `SELF_LOCALIZED_SURFACES`——自己解出语言，第一层照扫（本轮新增）；
 * - `TEXT_FREE_SURFACES`——渲染零用户可见文字，认领由本门禁机器复核（本轮新增）。
 *
 * 本门禁的牙全在**关系**上：候选集由源码树现读（不抄），四份清单的并集必须覆盖每个
 * 候选、恰一份认领、不许有死条目；两桶新认领各带一条自证（`SELF_LOCALIZED` 必须真的
 * 含取语言的代码，`TEXT_FREE` 必须真的没有文字）。共享尺子 `walkFiles` 来自
 * `page-template-coverage-lib.mjs`——「怎么走树」不许在两份门禁里各写一遍（R16.333 的教训）。
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { walkFiles } from "./page-template-coverage-lib.mjs";
import {
  LOCALE_FREE_SURFACES,
  SELF_LOCALIZED_SURFACES,
  SINGLE_LANGUAGE_FILES,
  TEXT_FREE_SURFACES,
  cjkStringLiterals,
  jsxTextNodes,
} from "./check-localized-labels.mjs";

const root = process.cwd();
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

/**
 * Next 的路由级渲染文件名。候选集的口径 = 这个名单 ∩ 真实源码树，
 * 所以 Next 新增一种特殊文件名时，要在这里认领一种「算候选」的形状——
 * 这一条清单本身也要有主人，不能悄悄膨胀。
 */
const RENDERER_KINDS =
  /^(?:page|layout|loading|error|global-error|global-not-found|not-found|template|default|forbidden|opengraph-image|twitter-image|icon|apple-icon)\.tsx$/;

/** `[locale]` 之外、`api` 之外的路由级渲染文件（路径用本机 sep，与认领清单同形状） */
function listNonLocaleRenderers() {
  return walkFiles(root, "src/app")
    .filter((f) => !f.split("/").includes("api") && !f.split("/").includes("[locale]"))
    .filter((f) => RENDERER_KINDS.test(path.posix.basename(f)))
    .map((f) => f.split("/").join(path.sep))
    .sort();
}

const CLAIMS = [
  ["SINGLE_LANGUAGE_FILES（拿不到 locale，禁同页混搭）", SINGLE_LANGUAGE_FILES],
  ["LOCALE_FREE_SURFACES（免第一层，品牌行归属待拍板 R16.52）", LOCALE_FREE_SURFACES],
  ["SELF_LOCALIZED_SURFACES（自己解出语言，第一层照扫）", SELF_LOCALIZED_SURFACES],
  ["TEXT_FREE_SURFACES（渲染零用户可见文字）", TEXT_FREE_SURFACES],
];

const candidates = listNonLocaleRenderers();

describe("check:localized-labels · [locale] 之外的渲染文件归属必须有主人（R16.337）", () => {
  it("候选集有地板：人口归零时这条门禁是空转", () => {
    // 现读人口 7 份。地板 5 留的是「Next 文件形状收敛」的余量，挡的是「走树路径
    // 被改坏 → 候选归零 → 后面每条都对着空集绿」的静默不判。
    expect(candidates.length).toBeGreaterThanOrEqual(5);
  });

  it("枚举器自证：根级、嵌套、动态段三种形状都要走到", () => {
    // 这三条各守一种走树盲区：根级直接躺在 src/app 下（not-found）、
    // 嵌套在子目录（icon）、动态段深处（share 的 OG 图）。
    // 漏任何一种，覆盖判定就会对着缩水的候选集说「全覆盖」。
    for (const mustSee of [
      ["src", "app", "not-found.tsx"],
      ["src", "app", "icon.tsx"],
      ["src", "app", "share", "[kind]", "[path]", "opengraph-image.tsx"],
    ]) {
      expect(candidates).toContain(mustSee.join(path.sep));
    }
  });

  it("每个候选恰被一份清单认领（清单外长出来的文件没有默认归属）", () => {
    const unclaimed = candidates.filter((file) =>
      CLAIMS.every(([, list]) => !list.includes(file)),
    );
    expect(
      unclaimed,
      "这些渲染文件不在任何认领清单里：先想清楚它归属哪一桶、为什么，再写进" +
        "check-localized-labels.mjs 对应的清单（带理由），而不是把清单删空让它溜过去",
    ).toEqual([]);
  });

  it("认领不许只长不消：清单里不许有源码树里已经不存在的文件", () => {
    for (const [name, list] of CLAIMS) {
      const stale = list.filter((rel) => !existsSync(path.join(root, rel)));
      expect(stale, `${name} 里这些文件已经不存在了，认领要跟着源码树消长`).toEqual([]);
    }
  });

  it("不许双重认领：一个文件只能归属一桶（两桶各管各的病）", () => {
    const seen = new Map();
    for (const [name, list] of CLAIMS) {
      for (const rel of list) {
        expect(
          seen.get(rel),
          `${rel} 同时出现在 ${seen.get(rel)} 和 ${name}——两份检查对同一个文件各说各话，归属就不成立`,
        ).toBeUndefined();
        seen.set(rel, name);
      }
    }
  });

  it("SELF_LOCALIZED 认领必须问过语言：文件里要有取语言的代码", () => {
    // 认领「自己解出语言」却没有 getDict( 也没有 pathname 的写法——认领是虚构的。
    for (const rel of SELF_LOCALIZED_SURFACES) {
      const source = read(rel);
      expect(
        /getDict\(|location\.pathname/.test(source),
        `${rel} 认领为「自己解出语言」，但源码里既没有 getDict( 也没有 location.pathname`,
      ).toBe(true);
    }
  });

  it("TEXT_FREE 认领必须是真的：文件里没有带字母的 JSX 文本节点，也没有写死的中文", () => {
    for (const rel of TEXT_FREE_SURFACES) {
      const source = read(rel);
      expect(
        jsxTextNodes(source),
        `${rel} 认领为「渲染零用户可见文字」，却出现了 JSX 文本节点——先重新归类（它该进哪一桶），不要把句子留着`,
      ).toEqual([]);
      expect(
        cjkStringLiterals(source),
        `${rel} 认领为「渲染零用户可见文字」，却揣着写死的中文——渲染不出文字的文件没有理由有它`,
      ).toEqual([]);
    }
  });
});
