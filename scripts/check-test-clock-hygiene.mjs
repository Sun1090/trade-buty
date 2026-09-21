#!/usr/bin/env node
/**
 * R14.6：测试时钟卫生巡检。口径 1（断言里直接读墙钟）阻断，口径 2（真实定时器未受控）报告式。
 *
 * 列出两类可解释的模式：断言里直接读墙钟、真实定时器且同文件从不使用受控时钟。
 * 判定逻辑在 `test-clock-hygiene-lib.mjs`，本文件只负责遍历与落盘。
 *
 * 用法：npm run check:test-clock-hygiene
 * 退出码：发现 clock-in-assertion → 1；uncontrolled-timer 只列出，不判失败。
 */
import fs from "node:fs";
import path from "node:path";
import {
  analyzeTestClockHygiene,
  isSelfFixture,
  renderClockHygieneMarkdown,
  shouldFailClockHygiene,
  summarizeClockHygiene,
} from "./test-clock-hygiene-lib.mjs";
import { writeReport } from "./report-write-lib.mjs";

const root = process.cwd();
const roots = ["src", "scripts", "e2e"];
const outputMarkdown = path.join(root, "docs/test-clock-hygiene.md");

function collectTestFiles(dir) {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return [];
  const found = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const full = path.join(absolute, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      found.push(...collectTestFiles(path.relative(root, full)));
      continue;
    }
    if (/\.test\.(ts|tsx|mjs)$/.test(entry.name)) found.push(path.relative(root, full));
  }
  return found;
}

const files = [...new Set(roots.flatMap(collectTestFiles))].filter((file) => !isSelfFixture(file)).sort();
const results = files.map((file) =>
  analyzeTestClockHygiene({ file, source: fs.readFileSync(path.join(root, file), "utf8") })
);
results.sort(
  (a, b) =>
    (b.findings.length > 0) - (a.findings.length > 0) || a.file.localeCompare(b.file)
);

const counts = summarizeClockHygiene(results);
const flagged = results.filter((result) => result.findings.length > 0);

writeReport(
  outputMarkdown,
  renderClockHygieneMarkdown({
    generatedAt: new Date().toISOString().slice(0, 10),
    scanned: files.length,
    results,
  })
);

console.log(
  `[clock-hygiene] 扫描 ${files.length} 个测试文件 · clock-in-assertion ${counts["clock-in-assertion"]} · uncontrolled-timer ${counts["uncontrolled-timer"]} → docs/test-clock-hygiene.md`
);
if (counts["uncontrolled-timer"] > 0) {
  console.log(
    `[clock-hygiene] ℹ️ ${counts["uncontrolled-timer"]} 处真实定时器未受控（报告式，逐条人工判断是否改 fake timers）`
  );
}
if (shouldFailClockHygiene(counts)) {
  const assertionFiles = flagged.filter((result) =>
    result.findings.some((finding) => finding.kind === "clock-in-assertion")
  );
  console.error(
    `[clock-hygiene] ❌ ${assertionFiles.length} 个文件里有 ${counts["clock-in-assertion"]} 处断言直接读墙钟：结果取决于机器此刻是几点、跑多快。改为注入时钟或用 vi.useFakeTimers() + setSystemTime()，明细见 docs/test-clock-hygiene.md`
  );
  process.exit(1);
}
