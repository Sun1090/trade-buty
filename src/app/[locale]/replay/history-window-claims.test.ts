/**
 * 「累计轮次 / 总正确率」这两张卡数的是 `readReplayHistory()` 返回的那一段，
 * 而台账写入时就被 `REPLAY_HISTORY_KEEP` 裁到最近 100 轮：做到第 101 轮，
 * 卡上的数字仍然停在 100，「累计」「总」就成了空话。标签不得再宣称全量，
 * 窗口大小则必须由常量代入，不能写死在文案里。
 * 旁边那张「最佳连击」走的是另一把尺子：它读独立的 `tb-replay-best`，只增不减、
 * 从不随窗口裁掉（R16.64）——所以脚注必须把两种窗口分别点名，不然修正前两句
 * 会把这张卡也说成 100 轮之内。
 */
import { describe, expect, it } from "vitest";
import { getDict } from "@/lib/i18n";
import { REPLAY_HISTORY_KEEP } from "@/lib/replay-history-limit";
import { REPLAY_TREND_POINTS } from "@/components/replay-trend";

/** 宣称「一辈子」的词：出现即意味着这些数字覆盖全部历史 */
const ALL_TIME_RE = /累计|总正确率|总计|总数|\bTotal\b|\bOverall\b|all[- ]time/i;

describe("回放训练记录的口径", () => {
  for (const locale of ["zh", "en"] as const) {
    const replay = getDict(locale).replay;

    it(`${locale}: 三张卡的标签不许宣称覆盖全部历史`, () => {
      const labels = [replay.histRounds, replay.histAccuracy, replay.histBest];
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
      // 三张卡不同一个尺子：连击走独立的 tb-replay-best，从不随 100 轮窗口裁掉
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
