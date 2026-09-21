/**
 * 内容报告写入：内容没变就不要重写文件。
 *
 * 这些 `docs/*.md` / `docs/*.json` 是入库的可审阅快照，但生成时都会盖上当天日期。
 * 之前每次跑全量门禁都会把十几个文件改成「只有日期不同」的工作区脏文件，
 * 既制造噪声 diff，也让「门禁跑完工作区应当干净」这类断言永远无法成立。
 *
 * 日期被规范化后才比较，所以内容不变时保留文件里原有的日期——
 * 此时报告日期读作「内容最后一次变化」，比「最后一次被机器跑过」更有信息量。
 *
 * 只用于纯重算型报告。**不要**用于按日追加的历史快照
 * （`kb:translation-status`、`kb:diff`、KB changelog 等），
 * 那里日期本身就是数据，跳过写入会丢历史。
 */
import fs from "node:fs";

const ANY_DATE = /\d{4}-\d{2}-\d{2}/g;

/** 忽略日期差异比较两份报告内容。 */
export function sameReportContent(existing, next) {
  if (existing === null || existing === undefined) return false;
  return String(existing).replace(ANY_DATE, "@DATE@") ===
    String(next).replace(ANY_DATE, "@DATE@");
}

/**
 * 按需写入报告。
 * @returns {"unchanged" | "created" | "updated"}
 */
export function writeReport(filePath, content) {
  let existing = null;
  try {
    existing = fs.readFileSync(filePath, "utf8");
  } catch {
    existing = null;
  }
  if (sameReportContent(existing, content)) return "unchanged";
  fs.writeFileSync(filePath, content);
  return existing === null ? "created" : "updated";
}
