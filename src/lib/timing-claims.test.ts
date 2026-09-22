/**
 * 界面里的「等待时长」是最容易随口编的数字，而站内没有任何延迟遥测可以支撑它。
 * 这里只允许一种写法：**能算出来的时间才写进文案**——轮询间隔由 `getMarketRefreshDelay`
 * 算出并代入 `{n}`；上游响应有多快，我们不知道，所以不许写「约需 10 秒」。
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getMarketRefreshDelay } from "./network-quality";

function read(...parts: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

const I18N = read("src", "lib", "i18n.ts");
const TICKER = read("src", "components", "market-ticker.tsx");

/** 已经被删掉的两类句子：禁令必须先证明它抓得住 */
const LEGACY = [
  'aiQuizGenerating: "AI 正在出题，约需 10 秒…",',
  'aiQuizGenerating: "Generating questions, about 10s…",',
  'slow: "慢速模式：每 60 秒更新一次。",',
];

const INVENTED_DURATION = /约需\s*\d+\s*秒|about\s*\d+\s*s\b/i;

function dictValue(src: string, key: string): string[] {
  return [...src.matchAll(new RegExp(`${key}: "([^"]*)"`, "g"))].map((m) => m[1]);
}

describe("等待时长的文案只能来自代码算得出的量", () => {
  it("AI 加载语不再承诺一个没测过的秒数", () => {
    const generating = dictValue(I18N, "aiQuizGenerating");
    expect(generating.length, "两种语言都要有出题中的文案").toBe(2);
    for (const text of generating) {
      expect(INVENTED_DURATION.test(text), `文案写死了时长：${text}`).toBe(false);
    }
    for (const sample of LEGACY.slice(0, 2)) {
      expect(INVENTED_DURATION.test(sample), "禁令抓不住旧文案").toBe(true);
    }
  });

  it("行情条慢速提示的秒数就是真实轮询间隔", () => {
    const slow = dictValue(TICKER, "slow");
    expect(slow.length, "zh/en 各一条慢速提示").toBe(2);
    const seconds = String((getMarketRefreshDelay("slow") ?? 0) / 1000);
    expect(seconds, "轮询间隔必须扫得出来，否则这条门禁是空转").not.toBe("0");
    for (const text of slow) {
      expect(text, `提示里没有 {n} 占位符：${text}`).toContain("{n}");
      expect(text).not.toMatch(/\d+\s*(?:秒|seconds)/);
    }
    // 非空转：抄死数字的旧写法必须被拦下
    expect(LEGACY[2]).not.toContain("{n}");
    expect(/每 60 秒/.test(LEGACY[2])).toBe(true);
  });
});
