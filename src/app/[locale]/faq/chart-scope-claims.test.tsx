// @vitest-environment jsdom
/**
 * FAQ 里「图表支持哪些币」这一句要渲染出来才算数：清单常量改了、文案没跟着改，
 * 只有真实 DOM 能告这个状。
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  CHART_QUICK_SYMBOLS,
  REPLAY_SYMBOLS,
  sameSymbolSet,
  symbolListLabel,
} from "@/lib/chart-symbols";

import FaqPage from "./page";

function props(locale: "zh" | "en"): PageProps<"/[locale]/faq"> {
  return {
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve({}),
  };
}

/** 数量必须出现，单位（个 / pairs / symbols）随文案分支变化，不在门禁里写死 */
const countRe = (n: number) => new RegExp(`${n}\\s*(?:个|pairs?|symbols?)`);

async function answerText(locale: "zh" | "en"): Promise<string> {
  render((await FaqPage(props(locale))) as ReactElement);
  const question = locale === "zh" ? "图表是实时行情吗？" : "Is the chart real-time?";
  // 「问：」前缀把问题拆进了同一个 <p> 的多个文本节点，只能按整张卡片找
  const card = screen.getAllByRole("listitem").find((item) => item.textContent?.includes(question));
  expect(card, `FAQ 里找不到「${question}」`).not.toBeNull();
  return card?.textContent ?? "";
}

describe("FAQ 的行情范围说明", () => {
  it("zh：快捷币对、可输入任意 USDT 交易对、回放各自的范围一应俱全", async () => {
    const text = await answerText("zh");
    expect(text).toContain("Binance 公开 API");
    expect(text).toContain(symbolListLabel(CHART_QUICK_SYMBOLS));
    expect(text).toContain(`${CHART_QUICK_SYMBOLS.length} 个快捷币对`);
    expect(text).toMatch(/输入[^。]*USDT[^。]*交易对/);
    // 数据源只有币安现货：范围不能写成「所有 USDT 交易对」
    expect(text).toContain("现货");
    const replay = text.match(/回放训练[^。]*/)?.[0] ?? "";
    expect(replay, "回放训练的范围没写出来").toMatch(countRe(REPLAY_SYMBOLS.length));
    expect(replay).toMatch(/自定义/);
    // 旧口径把范围说死成四个
    expect(text).not.toContain("四个币种");
    expect(text).not.toMatch(/只支持|仅支持/);
  });

  it("en：同样由清单生成，并交代自定义输入", async () => {
    const text = await answerText("en");
    expect(text).toContain("Binance");
    expect(text).toContain(symbolListLabel(CHART_QUICK_SYMBOLS));
    expect(text).toMatch(/any Binance spot pair quoted in USDT/i);
    expect(text).toMatch(/type in/i);
    const replay = text.match(/Replay training[^.]*/i)?.[0] ?? "";
    expect(replay, "replay scope is missing").toMatch(countRe(REPLAY_SYMBOLS.length));
    expect(replay).toMatch(/custom/i);
  });

  it("同一份清单在同一条回答里只念一遍", async () => {
    // 回放与快捷按钮现在是同一批标的；文案照抄两遍清单的话，改一处就会漏另一处
    const label = symbolListLabel(CHART_QUICK_SYMBOLS);
    const zh = await answerText("zh");
    const en = await answerText("en");
    const times = (s: string) => s.split(label).length - 1;
    const expected = sameSymbolSet(REPLAY_SYMBOLS, CHART_QUICK_SYMBOLS) ? 1 : 2;
    expect(times(zh), `zh 把清单念了 ${times(zh)} 遍`).toBe(expected);
    expect(times(en), `en 把清单念了 ${times(en)} 遍`).toBe(expected);
  });
});
