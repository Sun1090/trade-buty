import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { K_MIN_COUNT, MAX_QUESTION_LEN, WINDOW_DAYS } from "./faq-candidates.mjs";
import { DEFAULT_ATTEMPTS, DEFAULT_TIMEOUT_MS } from "./link-patrol.mjs";

/**
 * R16.34：`docs/ops.md` 里的巡检参数（词典规模、聚类窗口、超时与重试）由代码决定，
 * 文档只是转述。转述写的是数字，代码改了数字不会有任何东西变红——读者照着过期的一段
 * 去判断「本站被什么防着、防到什么程度」，比没有这段说明更糟。
 * 这里把每一处转述钉回它对应的常量，并要求句子本身必须还在：改个措辞不能绕过核对。
 */

const opsPath = "docs/ops.md";
const synonymsPath = "src/lib/search-synonyms.ts";

/** 中文计数词也认，因为文档写的是「重试一次」而不是「retries = 2」。 */
const CN_DIGITS = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

function countNumeric(text, pattern) {
  const match = pattern.exec(text);
  if (!match) return null;
  const word = match[1];
  return /^\d+$/.test(word) ? Number(word) : (CN_DIGITS[word] ?? null);
}

/** 同义词组数从词典源码数出来：每组一行 `{ id: "..."`，与文档口径（「N 组」）一致。 */
function synonymGroupCount() {
  const source = fs.readFileSync(synonymsPath, "utf8");
  return [...source.matchAll(/^\s*\{ id: "/gm)].length;
}

const CLAIMS = [
  {
    label: "同义词词典组数",
    pattern: /等 (\d+) 组/,
    actual: () => synonymGroupCount(),
  },
  {
    label: "FAQ 候选聚类窗口（天）",
    pattern: /近 (\d+) 天 unhelpful/,
    actual: () => WINDOW_DAYS,
  },
  {
    label: "FAQ 候选 k-匿名门槛（次）",
    pattern: /出现 ≥(\d+) 次/,
    actual: () => K_MIN_COUNT,
  },
  {
    label: "FAQ 候选截断长度（字符）",
    pattern: /截到 (\d+) 字符/,
    actual: () => MAX_QUESTION_LEN,
  },
  {
    label: "外链巡检超时（秒）",
    pattern: /(\d+)s 超时/,
    actual: () => DEFAULT_TIMEOUT_MS / 1000,
  },
  {
    label: "外链巡检重试次数",
    pattern: /网络错误重试([一二三四五六七八九十\d])次/,
    actual: () => DEFAULT_ATTEMPTS - 1,
  },
];

const ops = fs.readFileSync(opsPath, "utf8");

describe("docs/ops.md 的巡检参数转述", () => {
  it("每个数字都等于代码里的那个常量", () => {
    const mismatched = [];
    for (const claim of CLAIMS) {
      const doc = countNumeric(ops, claim.pattern);
      if (doc === null) {
        mismatched.push(`${claim.label}：句子没匹配上（改措辞会绕过核对，请同步本门禁）`);
        continue;
      }
      if (doc !== claim.actual()) {
        mismatched.push(`${claim.label}：文档写 ${doc}，代码是 ${claim.actual()}`);
      }
    }
    expect(mismatched, `docs/ops.md 与代码常量不一致：\n${mismatched.join("\n")}`).toEqual([]);
  });

  it("核对确实取到数字，不是在跟空集合说话", () => {
    // 词典塌成空数组时，「组数一致」会退化成 0 === 0 的假绿。
    expect(synonymGroupCount()).toBeGreaterThanOrEqual(20);
    expect(CLAIMS.length).toBeGreaterThanOrEqual(6);
  });

  it("数字被抹成措辞时当场判失败，而不是静默跳过", () => {
    const rewritten = ops.replace(/等 (\d+) 组/, "等若干组");
    expect(rewritten).not.toBe(ops); // 前提：句式还在这里
    expect(countNumeric(rewritten, /等 (\d+) 组/)).toBeNull();
  });
});
