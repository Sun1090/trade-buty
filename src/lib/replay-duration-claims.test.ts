/**
 * R16.202：`/stats` 回放时长那块以前写着「旧回放记录缺少耗时数据；完成一轮新的回放
 * 后开始记录时长」。前半句把缺时长全推给老记录，后半句向用户承诺做完一轮就有时长。
 *
 * 两条代码都不保证：`replay-trainer.tsx` 存档时写的是
 * `...(elapsed > 0 ? { durationSec: elapsed } : {})`，而 `elapsed` 是
 * `Math.round(毫秒差 / 1000)` ——一轮不到半秒就四舍五入成 0，走「干脆不写这个字段」
 * 那一支，同一支还跳过 `addStudyTime`。所以**新**记录一样可能没有时长，
 * 「再做一轮」并不保证下一格有数（真事实由 `replay-trainer.test.tsx` 的冻时钟用例演过）。
 *
 * 这里只做两件事：禁掉「缺时长=老记录的事」和「做完一轮就开始记」这两种说法，
 * 并要求句子把「四舍五入成 0 秒」这一支和「平均每轮只按有时长的轮算」说出来。
 * 那句关于 0 秒的话绑在存档条件上：哪天写入规则改成无条件带时长，源码锚点先红，
 * 免得文案留着一句已经多余的免责声明。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { STATS_DICTS } from "./i18n-stats";

const TRAINER = "src/components/replay-trainer.tsx";

/** 「缺时长只是老记录的问题、做完一轮就有」——代码没这条保证 */
const PROMISE_ON_NEXT_ROUND =
  /(完成|做完|做)一[次轮][^。]{0,16}(就|后)[^。]{0,8}(开始|即)?[^。]{0,4}(记录|统计|有时长)|finishing a new round starts|complete a new round.*starts/i;
/** 句子仍然要说清两头：老记录没这个字段 / 新轮次也可能没量到 */
const MENTIONS_OLD = /旧.{0,4}记录|老.{0,4}记录|older (replay )?records/;
const MENTIONS_NEW = /新记录|新轮次|new round/i;
const MENTIONS_ZERO = /0 ?秒|rounds to 0|round(ed)? to zero/i;

/** 存档那一支的真实形状：耗时被四舍五入成 0 就不写字段 */
const UNTIMED_BRANCH =
  /elapsed > 0 \? \{ durationSec: elapsed \} : \{\}/;
const ROUND_TO_SECONDS = /Math\.round\(\(Date\.now\(\) - roundStartRef\.current\) \/ 1000\)/;

describe("回放时长那块不说「只有旧记录缺时长」", () => {
  it("禁令抓得住旧文案", () => {
    const legacy = [
      "旧回放记录缺少耗时数据；完成一轮新的回放后开始记录时长。",
      "Older replay records have no duration; finishing a new round starts the timer.",
    ];
    const missed = legacy.filter((s) => !PROMISE_ON_NEXT_ROUND.test(s));
    expect(missed, `这些旧写法没被抓到：${missed.join(" / ")}`).toEqual([]);
  });

  it("两种语言的这句既点名老记录，也点名没量到秒数的新轮次", () => {
    for (const locale of ["zh", "en"] as const) {
      const text = STATS_DICTS[locale].replayNoDurations;
      expect(text, `${locale} 这句没提到新轮次也可能没时长`).toMatch(MENTIONS_NEW);
      expect(text, `${locale} 这句不许只把锅给老记录`).toMatch(MENTIONS_OLD);
      expect(text, `${locale} 这句得说出「四舍五入成 0 秒就不记」这一支`).toMatch(
        MENTIONS_ZERO,
      );
      expect(
        PROMISE_ON_NEXT_ROUND.test(text),
        `${locale} 这句又在承诺「做完一轮就有」：${text}`,
      ).toBe(false);
    }
    // 「平均每轮」这个名字必须和同一块里的标签一致（一件事一个名字）
    expect(STATS_DICTS.zh.replayNoDurations).toContain(STATS_DICTS.zh.replayTrendAvg);
    expect(STATS_DICTS.en.replayNoDurations).toContain(STATS_DICTS.en.replayTrendAvg);
  });

  it("说明句不许再写「耗时只从新记录开始累计」", () => {
    for (const locale of ["zh", "en"] as const) {
      const text = STATS_DICTS[locale].replayTrendDesc;
      expect(
        /只从新记录|from new records|only accrues from new/i.test(text),
        `${locale} 的说明句把新记录说成一定有时长：${text}`,
      ).toBe(false);
    }
  });

  it("文案绑的那条支路还在：耗时被四舍五入成 0 就不写字段", () => {
    const src = readFileSync(path.join(process.cwd(), TRAINER), "utf8");
    expect(src, "存档条件已改，这段免责声明该跟着重新写").toMatch(UNTIMED_BRANCH);
    expect(src, "耗时不再是「毫秒差四舍五入到秒」，句子说的 0 秒就不成立了").toMatch(
      ROUND_TO_SECONDS,
    );
  });
});
