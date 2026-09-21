/**
 * R14.6：测试时钟卫生巡检——纯计算与 Markdown 渲染。
 *
 * 背景（真实事故）：`quiz.test.tsx` 的学习时长断言只在单跑 <500ms 时成立，全量并行必现抖动，
 * 而这类依赖在 R14 之前没人知道仓库里还有多少。抖动不是随机噪声，是「断言读走了墙钟」的确定性后果。
 *
 * 判定口径刻意收窄到两类可解释的模式，而不是「文件里出现过 Date.now 就算」：
 *   1. clock-in-assertion：`expect(...)` 语句里直接读 `Date.now()` / `performance.now()`，
 *      或拿两个时钟读数相减去比大小——断言的真假取决于机器此刻是几点、跑多快。
 *   2. uncontrolled-timer：测试里出现真实 `setTimeout` / `setInterval` 而同文件从不使用
 *      `vi.useFakeTimers()` / `vi.advanceTimersByTime()` 等受控时钟。
 * 第 2 类只是「需要看一眼」的清单，不当场判失败（`await new Promise(r => setTimeout(r, 0))`
 * 这类排空微任务的写法是合法的）；报告式列出让改动排队进行。
 */

const FAKE_CLOCK = /\b(useFakeTimers|advanceTimersByTime|advanceTimersToNextTimer|setSystemTime|runAllTimers|runOnlyPendingTimers)\b/;
const REAL_TIMER = /\b(?:setTimeout|setInterval)\s*\(/;
const CLOCK_READ = /\b(?:Date\.now|performance\.now)\s*\(\s*\)/;

/**
 * 巡检器自己的单测：夹具里那些 `expect(... Date.now() ...)` 是**字符串**，
 * 是被检查模式的样本而不是缺陷。逐行剥字符串覆盖不到跨行模板字面量，
 * 所以显式排除这一份，并在报告里说明，避免让噪声淹没真实命中。
 */
export const SELF_FIXTURES = Object.freeze(["scripts/test-clock-hygiene-lib.test.mjs"]);

export function isSelfFixture(file) {
  return SELF_FIXTURES.includes(String(file).replace(/^\.\//, ""));
}

/** 把源码切成「逻辑语句」：以 expect( 开头并把后续行拼到括号配平为止。 */
function expectStatements(source) {
  const lines = String(source).split(/\r?\n/);
  const statements = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!/\bexpect\s*\(/.test(lines[i])) continue;
    let depth = 0;
    let text = "";
    for (let j = i; j < lines.length; j += 1) {
      text += `${lines[j]}\n`;
      for (const ch of lines[j]) {
        if (ch === "(") depth += 1;
        else if (ch === ")") depth -= 1;
      }
      if (depth <= 0) break;
    }
    statements.push({ line: i + 1, text });
  }
  return statements;
}

/**
 * 分析一个测试文件的时钟卫生。
 * @returns {{ file: string, findings: Array<{ kind: string, line: number, text: string }> }}
 */
export function analyzeTestClockHygiene({ file = "", source = "" } = {}) {
  const findings = [];
  const text = String(source);

  for (const statement of expectStatements(text)) {
    if (!CLOCK_READ.test(statement.text)) continue;
    findings.push({
      kind: "clock-in-assertion",
      line: statement.line,
      text: statement.text.split("\n").map((l) => l.trim()).filter(Boolean).join(" ").slice(0, 160),
    });
  }

  const usesRealTimer = REAL_TIMER.test(text);
  const usesFakeClock = FAKE_CLOCK.test(text);
  if (usesRealTimer && !usesFakeClock) {
    const lines = text.split(/\r?\n/);
    const index = lines.findIndex((l) => REAL_TIMER.test(l));
    findings.push({
      kind: "uncontrolled-timer",
      line: index >= 0 ? index + 1 : 1,
      text:
        index >= 0
          ? lines[index].trim().slice(0, 160)
          : "使用真实 setTimeout / setInterval，同文件未使用受控时钟",
    });
  }

  findings.sort((a, b) => a.kind.localeCompare(b.kind) || a.line - b.line);
  return { file: String(file), findings };
}

export function summarizeClockHygiene(results = []) {
  const counts = { "clock-in-assertion": 0, "uncontrolled-timer": 0 };
  for (const result of results) {
    for (const finding of result.findings ?? []) {
      if (counts[finding.kind] !== undefined) counts[finding.kind] += 1;
    }
  }
  return counts;
}

/**
 * 只有口径 1 阻断。
 *
 * 口径 1 的判定没有已知误报（今天的真实命中已清零），所以它可以当门禁：新写一条读墙钟的
 * 断言就会让 CI 变红。口径 2 需要人判断（`await new Promise(r => setTimeout(r, 0))`
 * 这类排空写法是合法的），强行阻断只会逼人往 CI 里塞豁免，因此保持报告式。
 */
export function shouldFailClockHygiene(counts = {}) {
  return Number(counts["clock-in-assertion"] ?? 0) > 0;
}

/** 渲染报告。`generatedAt` 由调用方传入，内容未变时不产生纯日期 diff（R14.5）。 */
export function renderClockHygieneMarkdown({ generatedAt, scanned, results } = {}) {
  const counts = summarizeClockHygiene(results);
  const flagged = results.filter((result) => (result.findings ?? []).length > 0);
  const lines = [
    "# 测试时钟卫生巡检（R14.6）",
    "",
    `> 自动生成于 ${generatedAt}（\`npm run check:test-clock-hygiene\`），勿手改。`,
    "",
    "抖动的典型来源是断言直接读墙钟：结果取决于机器此刻是几点、跑多快。`quiz.test.tsx` 的学习时长",
    "断言就是这么写的——单跑 <500ms 才成立，全量并行必现抖动。本巡检只列**可解释的两类模式**，",
    "报告式不阻断（`await new Promise(r => setTimeout(r, 0))` 这类排空微任务的写法是合法的）。",
    "",
    "- 判定口径 1 `clock-in-assertion`：`expect(...)` 语句里出现 `Date.now()` / `performance.now()`。",
    "  这一类应当改为注入时钟或用 `vi.useFakeTimers()` + `setSystemTime()` 固定。",
    "- 判定口径 2 `uncontrolled-timer`：使用真实 `setTimeout` / `setInterval` 且同文件从不使用受控时钟。",
    "  这一类需要人工判断，逐条改或明确保留。",
    "",
    "> 巡检器自己的单测（夹具里含有被检查模式的字符串）不参与扫描，见",
    "> `test-clock-hygiene-lib.mjs` 的 `SELF_FIXTURES`。",
    "",
    "## 汇总",
    "",
    `- 扫描测试文件：${scanned} 个，命中文件：${flagged.length} 个`,
    `- clock-in-assertion：${counts["clock-in-assertion"]}`,
    `- uncontrolled-timer：${counts["uncontrolled-timer"]}`,
    "",
  ];

  if (flagged.length === 0) {
    lines.push("没有发现依赖未受控时钟的断言或定时器。", "");
    return `${lines.join("\n")}\n`;
  }

  lines.push("| 口径 | 文件 | 行 | 片段 |", "|---|---|---|---|");
  for (const result of flagged) {
    for (const finding of result.findings) {
      const snippet = finding.text.replace(/\|/g, "\\|");
      lines.push(`| ${finding.kind} | ${result.file} | ${finding.line} | \`${snippet}\` |`);
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}
