/**
 * 「累计轮次 / 总正确率」这两张卡数的是 `readReplayHistory()` 返回的那一段，
 * 而台账写入时就被 `REPLAY_HISTORY_KEEP` 裁到最近 100 轮：做到第 101 轮，
 * 卡上的数字仍然停在 100，「累计」「总」就成了空话。标签不得再宣称全量，
 * 窗口大小则必须由常量代入，不能写死在文案里。
 */
import { describe, expect, it } from "vitest";
import { getDict } from "@/lib/i18n";
import { REPLAY_HISTORY_KEEP } from "@/lib/replay-history-limit";

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

    it(`${locale}: 窗口轮数走 {n} 占位符，由 REPLAY_HISTORY_KEEP 代入`, () => {
      expect(replay.histScopeTpl, "窗口大小写进字典就会和常量脱钩").toContain("{n}");
      const rendered = replay.histScopeTpl.replace("{n}", String(REPLAY_HISTORY_KEEP));
      expect(rendered).toContain(String(REPLAY_HISTORY_KEEP));
      expect(rendered).not.toContain("{n}");
    });
  }
});
