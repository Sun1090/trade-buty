/**
 * 测验得分百分比——纯函数，不碰存储，方便 UI、统计与趋势共用。
 *
 * `best` 是历史存档：题库改小后它可能大于当前题数，因此按当前题数封顶。
 * 否则雷达图、成绩条、分享卡与等级判定会出现 120% 这种不存在的分数。
 */
export function quizScorePct(best: number, total: number): number {
  if (!(total > 0) || !(best > 0)) return 0;
  return Math.min(100, Math.round((best / total) * 100));
}

/**
 * 卷面上写出来的「答对几题」。存档超过当前题数时同样封顶，
 * 否则成绩条、分享卡与章节测卡片会写出「历史最佳 99/3」这种不存在的分数。
 */
export function quizScoreCount(best: number, total: number): number {
  if (!(total > 0) || !(best > 0)) return 0;
  return Math.min(Math.round(best), total);
}
