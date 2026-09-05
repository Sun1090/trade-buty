/**
 * R6.9：FAQ 候选清单——从 ai_feedback 表的高频「无用」反馈中
 * 聚类出高频问题，输出 FAQ 候选清单（人工审后补进 FAQ 页）。
 * 需要 SUPABASE_SERVICE_ROLE_KEY；无 key 时友好跳过（不阻断）。
 * 用法：npm run ops:faq-candidates
 */
import fs from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, KEY);

// 近 30 天 unhelpful 反馈的 question 聚类（简单去空前缀 + 计数）
const since = new Date(Date.now() - 30 * 86400_000).toISOString();
const { data, error } = await supabase
  .from("ai_feedback")
  .select("question, created_at")
  .eq("rating", "unhelpful")
  .gte("created_at", since)
  .limit(1000);

if (error) {
  console.error(`⚠️ 查询失败（不阻断）：${error.message}`);
  process.exit(0);
}

const counter = new Map();
for (const row of data ?? []) {
  const q = (row.question ?? "").trim().toLowerCase();
  if (q.length < 4) continue;
  counter.set(q, (counter.get(q) ?? 0) + 1);
}
const top = [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);

const lines = [
  "# FAQ 候选清单（近 30 天 unhelpful 高频问题）",
  "",
  `> 自动生成于 ${new Date().toISOString().slice(0, 10)}（npm run ops:faq-candidates），勿手改。`,
  "",
  ...(top.length === 0
    ? ["近 30 天没有足够的 unhelpful 反馈样本。"]
    : [
        "| 次数 | 问题 |",
        "|---|---|",
        ...top.map(([q, n]) => `| ${n} | ${q.replace(/\|/g, "\\|").slice(0, 80)} |`),
      ]),
  "",
];
fs.writeFileSync(path.join(root, "docs/faq-candidates.md"), lines.join("\n"));
console.log(`✅ FAQ 候选清单已生成（${top.length} 条）→ docs/faq-candidates.md`);
