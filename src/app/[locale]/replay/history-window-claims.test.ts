/**
 * 「训练轮次 / 平均正确率」这两张卡数的是 `readReplayHistory()` 返回的那一段，
 * 而台账写入时就被 `REPLAY_HISTORY_KEEP` 裁到最近 100 轮：做到第 101 轮，
 * 卡上的数字仍然停在 100，「累计」「总」就成了空话。标签不得再宣称全量，
 * 窗口大小则必须由常量代入，不能写死在文案里。
 * 旁边那张「历史最佳连胜」走的是另一把尺子：它读独立的 `tb-replay-best`，只增不减、
 * 从不随窗口裁掉（R16.64）——所以它天生是全量数，脚注必须把两种窗口分别点名，
 * 不然前两句会把这张卡也说成 100 轮之内。它不在上面那条禁令里，正是因为这个。
 *
 * R16.128 把同一个检查推到 `/stats`：那张仪表盘上的「回放轮数」「回放正确率」和
 * 学习概览的「回放训练」读的是**同一个** `readReplayHistory()`，此前整页没有一处
 * 提到 100 轮的天花板——回放页早就写了，统计页没写。
 */
import { describe, expect, it } from "vitest";
import { getDict } from "@/lib/i18n";
import { STATS_DICTS } from "@/lib/i18n-stats";
import { REPLAY_HISTORY_KEEP } from "@/lib/replay-history-limit";
import { REPLAY_TREND_POINTS } from "@/components/replay-trend";

/** 宣称「一辈子」的词：出现即意味着这些数字覆盖全部历史 */
const ALL_TIME_RE = /累计|总正确率|总计|总数|\bTotal\b|\bOverall\b|all[- ]time/i;

describe("回放训练记录的口径", () => {
  for (const locale of ["zh", "en"] as const) {
    const replay = getDict(locale).replay;

    it(`${locale}: 两张受窗口管的卡不许宣称覆盖全部历史`, () => {
      // 「历史最佳连胜」故意不在这份名单里：它本来就是全量尺子，见文件头
      const labels = [replay.histRounds, replay.histAccuracy];
      expect(labels.every((l) => l.length > 0), "标签不能是空串").toBe(true);
      for (const label of labels) {
        expect(label.match(ALL_TIME_RE), `「${label}」在承诺全量，而台账只留最近 ${REPLAY_HISTORY_KEEP} 轮`).toBeNull();
      }
    });

    it(`${locale}: 脚注把两种窗口各自交代清楚`, () => {
      expect(replay.histScopeTpl, "窗口大小写进字典就会和常量脱钩").toContain("{n}");
      const rendered = replay.histScopeTpl.replace("{n}", String(REPLAY_HISTORY_KEEP));
      expect(rendered).toContain(String(REPLAY_HISTORY_KEEP));
      expect(rendered).not.toContain("{n}");
      // 两张卡两种尺子：连胜走独立的 tb-replay-best，从不随 100 轮窗口裁掉
      expect(rendered, `脚注没点名「${replay.histBest}」，就会被当成也在 100 轮之内`).toContain(replay.histBest);
      expect(rendered).toMatch(/全部历史|ever been|all rounds/i);
    });

    it(`${locale}: 折线的窗口是第三个数，脚注单独交代它`, () => {
      expect(replay.trendScopeTpl, "折线窗口写死就会和 slice 脱钩").toContain("{n}");
      const rendered = replay.trendScopeTpl.replace("{n}", String(REPLAY_TREND_POINTS));
      expect(rendered).toContain(String(REPLAY_TREND_POINTS));
      expect(rendered).not.toContain("{n}");
      // 三个窗口必须是三句话，不能合并成一句「以上都只统计最近 N 轮」
      expect(replay.trendScopeTpl).not.toBe(replay.histScopeTpl);
    });
  }
});

/**
 * R16.128：统计页那三处回放数走的是同一个被裁过的台账。
 *
 * 「回放轮数」「回放正确率」（详细统计栅格）与学习概览的「回放训练」都来自
 * `aggregateStats()` 里的 `readReplayHistory()`——同一条 100 轮的天花板。旁边那格
 * 「历史最佳连胜」不在这三处里：它读 `readReplayBest()`（`tb-replay-best` 只增不减）。
 */
describe("统计页的回放数也交代自己的窗口", () => {
  for (const locale of ["zh", "en"] as const) {
    const dict = STATS_DICTS[locale];

    it(`${locale}: 两句话都把窗口写成常量代入的 {n}`, () => {
      for (const key of ["replayScopeTpl", "replayScopeShort"] as const) {
        expect(dict[key], `${key} 没有 {n} 就会和 REPLAY_HISTORY_KEEP 脱钩`).toContain("{n}");
        const rendered = dict[key].replace("{n}", String(REPLAY_HISTORY_KEEP));
        expect(rendered).toContain(String(REPLAY_HISTORY_KEEP));
        expect(rendered).not.toContain("{n}");
      }
    });

    it(`${locale}: 这两张卡的标签自己不许宣称全量`, () => {
      for (const label of [dict.replay, dict.accuracy]) {
        expect(label.match(ALL_TIME_RE), `「${label}」在承诺全量，而台账只留最近 ${REPLAY_HISTORY_KEEP} 轮`).toBeNull();
      }
    });
  }
});
