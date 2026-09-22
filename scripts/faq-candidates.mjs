/**
 * R6.9：FAQ 候选清单——从 ai_feedback 表的高频「无用」反馈中
 * 聚类出高频问题，输出 FAQ 候选清单（人工审后补进 FAQ 页）。
 * 需要 SUPABASE_SERVICE_ROLE_KEY；无 key 时友好跳过（不阻断）。
 * 用法：npm run ops:faq-candidates
 *
 * 隐私红线：这份报告会提交进公开仓库，所以只收录出现 ≥K_MIN_COUNT 次的问题——
 * 单人独条的用户原话（可能带仓位、资金、平台名）不得被发布出去。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { writeReport } from "./report-write-lib.mjs";

/** 公开报告的最小样本数（k-匿名门槛） */
export const K_MIN_COUNT = 3;
const MAX_QUESTION_LEN = 80;

/** 归一 + 计数 + k-匿名过滤，返回按次数降序的问题 */
export function clusterQuestions(rows, { minCount = K_MIN_COUNT, limit = 20 } = {}) {
  const counter = new Map();
  for (const row of rows ?? []) {
    const q = String(row?.question ?? "").trim().toLowerCase();
    if (q.length < 4) continue;
    counter.set(q, (counter.get(q) ?? 0) + 1);
  }
  return [...counter.entries()]
    .filter(([, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, limit)
    .map(([question, count]) => ({ question: question.slice(0, MAX_QUESTION_LEN), count }));
}

/** 生成报告正文（表格里的用户原话做 markdown 转义） */
export function renderReport(rows, generatedAt = new Date()) {
  const top = clusterQuestions(rows);
  return [
    "# FAQ 候选清单（近 30 天 unhelpful 高频问题）",
    "",
    `> 自动生成于 ${generatedAt.toISOString().slice(0, 10)}（npm run ops:faq-candidates），勿手改。`,
    `> 本文件在公开仓库里：只收录出现 ≥${K_MIN_COUNT} 次的问题，单人独条不写入。`,
    "",
    ...(top.length === 0
      ? ["近 30 天没有足够的 unhelpful 反馈样本（每个问题至少要有 " + K_MIN_COUNT + " 次）。"]
      : [
          "| 次数 | 问题 |",
          "|---|---|",
          ...top.map(
            ({ question, count }) =>
              `| ${count} | ${question.replace(/\\/g, "\\\\").replace(/\|/g, "\\|")} |`,
          ),
        ]),
    "",
  ].join("\n");
}

async function run() {
  const root = process.cwd();
  try {
    for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    // .env.local 不存在则依赖已有环境变量
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !KEY) {
    console.log("ℹ️ 未配置 SUPABASE_SERVICE_ROLE_KEY，跳过 FAQ 候选分析（非阻断）");
    return;
  }

  const supabase = createClient(SUPABASE_URL, KEY);
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data, error } = await supabase
    .from("ai_feedback")
    .select("question, created_at")
    .eq("rating", "unhelpful")
    .gte("created_at", since)
    .limit(1000);

  if (error) {
    console.error(`⚠️ 查询失败（不阻断）：${error.message}`);
    return;
  }

  const top = clusterQuestions(data);
  writeReport(path.join(root, "docs/faq-candidates.md"), renderReport(data));
  console.log(
    `✅ FAQ 候选清单已生成（${top.length} 条，已按 ≥${K_MIN_COUNT} 次做 k-匿名过滤）→ docs/faq-candidates.md`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await run();
}
