/**
 * R16.208：同步差异那两句只说测得到的东西——比对的是同一账号云端那一行，不是「另一台设备」。
 *
 * 事实链条（都在代码里，不靠推测）：
 * - `sync-layer.ts` 用 `.eq("user_id", id)` 取回这个账号的云端行，交给
 *   `detectSyncConflicts(input)`；`input.cloudWrong` / `input.cloudGoalMin` 都是云端值。
 * - `sync-conflicts.ts` 里没有任何设备标识：行上没有，比对时也不看。
 * - 分歧同样可以由本机自己造出来：离线写队列被 `MAX_QUEUE` 挤掉若干条，
 *   或本机推送后本地又改过。
 * 所以「另一台设备有 N 处与本机不同」把一件没测量过的事说成了测过的——只有一台设备的人
 * 登录后被引去排查一台不存在的设备。改成点名比对的那一方（云端）。
 *
 * 另一半：横幅按 kind 逐类说清「哪一边赢」，kind 是检测器能发出来的全部三类
 * （goal / weekly-goal / wrongbook）。旧英文句只说了 "your daily goal"，每周目标那一类
 * 根本不在句子里。这里把 kind 从源码里扫出来（带地板，删掉一个 kind 也会报红），
 * 并禁止正文只用单一档位的名词——旧那句喂给同一个禁令必须报红。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getStatsDict } from "./i18n-stats";

const SOURCE = readFileSync(
  resolve(process.cwd(), "src/lib/sync-conflicts.ts"),
  "utf8",
);

/** 检测器实际 push 出来的 kind 字面量（不含接口里那行联合类型声明） */
const EMITTED_KINDS = [...SOURCE.matchAll(/kind:\s*"([a-z-]+)"/g)].map((m) => m[1]);

/** 每一类由横幅里的哪个词点名 */
const COVERED_BY: Record<"zh" | "en", Record<string, RegExp>> = {
  zh: { goal: /目标档位/, "weekly-goal": /目标档位/, wrongbook: /错题复习计划/ },
  en: { goal: /\bgoal\b/i, "weekly-goal": /\bgoal\b/i, wrongbook: /review plan/i },
};

/** 「宣布有一台别的设备」的写法，两种语言 */
const DEVICE_CLAIM =
  /另一台设备|别的设备|其他设备|多设备|another device|other device|other machine|multi-device/i;

/** 只用单一档位的名词去覆盖两类目标：`weekly-goal` 因此不在句子里 */
const ONE_TIER_ONLY = /每日目标|每天的目标|每周目标|daily goal|weekly goal/i;

describe("同步差异横幅说的是云端那一行，不是「另一台设备」", () => {
  it("kind 扫描真的扫到了检测器发的那三类（扫空或变少就是门禁瞎了）", () => {
    expect([...new Set(EMITTED_KINDS)].sort()).toEqual(["goal", "weekly-goal", "wrongbook"]);
    expect(EMITTED_KINDS.length).toBeGreaterThanOrEqual(3);
  });

  for (const locale of ["zh", "en"] as const) {
    const dict = getStatsDict(locale);

    it(`${locale}: 标题与正文都不许说「另一台设备」`, () => {
      expect(dict.conflictTitle, `「${dict.conflictTitle}」`).not.toMatch(DEVICE_CLAIM);
      expect(dict.conflictBodyTpl, `「${dict.conflictBodyTpl}」`).not.toMatch(DEVICE_CLAIM);
    });

    it(`${locale}: 正文点名比对的那一方，并保留 {n}`, () => {
      expect(dict.conflictBodyTpl).toContain("{n}");
      expect(dict.conflictBodyTpl, "比对对象必须是云端那一行").toMatch(
        locale === "zh" ? /云端/ : /cloud/i,
      );
      expect(dict.conflictBodyTpl, "要说清保留的是哪一边").toMatch(
        locale === "zh" ? /本机/ : /this device|set here/i,
      );
    });

    it(`${locale}: 检测器发每一类 kind，正文都得点名`, () => {
      for (const kind of new Set(EMITTED_KINDS)) {
        const re = COVERED_BY[locale][kind];
        expect(re, `kind「${kind}」没有对应的判据，这条门禁对它瞎着`).toBeDefined();
        expect(dict.conflictBodyTpl, `${locale} 这句没点名 kind「${kind}」`).toMatch(re);
      }
    });

    it(`${locale}: 两类目标共用一个不带档位的名词`, () => {
      expect(dict.conflictBodyTpl, `「${dict.conflictBodyTpl}」只点名了一个档位`).not.toMatch(
        ONE_TIER_ONLY,
      );
    });
  }

  it("正向对照——旧那三句必须被同一个禁令报出来", () => {
    const deviceLegacy = [
      "多设备同步提示",
      "另一台设备有 {n} 处数据与本机不同，已自动合并：目标档位保留本机，错题复习计划取较新一条。",
      "{n} item(s) differ from another device and were merged automatically: your daily goal stays as set here, and the newer review plan wins.",
    ];
    const missed = deviceLegacy.filter((s) => !DEVICE_CLAIM.test(s));
    expect(missed, `这些旧写法没被设备禁令抓到：${missed.join(" / ")}`).toEqual([]);

    const tierLegacy =
      "{n} item(s) differ from another device and were merged automatically: your daily goal stays as set here, and the newer review plan wins.";
    expect(ONE_TIER_ONLY.test(tierLegacy), "旧英文句只说了 daily goal，档位禁令要抓到它").toBe(
      true,
    );
    // 中文旧句那两处都覆盖（「目标档位」本就是不带档位的说法），它只栽在设备那一条上
    expect(ONE_TIER_ONLY.test("目标档位保留本机")).toBe(false);
  });
});
