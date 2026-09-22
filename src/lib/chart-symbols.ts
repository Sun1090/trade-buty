/**
 * 「交易所行情标的」口径：Practice 的三个界面各自列出哪些币种，只在这里写一次。
 *
 * 三份清单故意不同：
 * - 图表快捷按钮给 4 个，并且允许输入任意以 USDT 计价的币安现货交易对；
 * - 回放只放这 4 个（历史长度与教学难度经过挑选，放开成任意标的等于放开「这题有没有答案」）；
 * - 首页行情条受版面限制，只放其中 3 个。
 * 不变量由 `chart-symbols.test.ts` 守住：后两份必须是快捷按钮清单的子集，
 * 否则会出现「某处宣传了另一个界面打不开的标的」。文案（FAQ）从这几份常量生成，
 * 不再手写币种名字。
 */

/** 图表上的快捷币对按钮 */
export const CHART_QUICK_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT"] as const;

/**
 * 自定义输入框接受的形状：任意以 USDT 计价的币对（图表 setSymbol 用的就是这一份）。
 * 允许数字，因为币安**现货**就有 `1INCHUSDT` 这类以数字开头的标的（实测 ticker/price 返回 200；
 * `1000PEPEUSDT` 只在其合约市场有，现货 -1121 Invalid symbol，输了会得到图表错误态）。
 */
export const CHART_CUSTOM_SYMBOL = /^[A-Z0-9]+USDT$/;

/** 回放可选的标的 */
export const REPLAY_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT"] as const;

/** 行情条展示的标的 */
export const TICKER_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"] as const;

/**
 * 两份清单是否为同一批标的（顺序无关）。文案用它决定要不要把名单念第二遍，
 * 门禁用它确认「只念了一遍」确实是清单相同的结果，而不是漏写。
 */
export function sameSymbolSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((s) => b.includes(s));
}

/** `BTCUSDT` → `BTC`：界面窄位（行情条、按钮）只展示计价货币以外的部分 */
export function symbolBase(symbol: string): string {
  return symbol.replace(/USDT$/, "");
}

/** `["BTCUSDT", …]` → `"BTC / ETH / BNB / SOL"`，供文案引用清单 */
export function symbolListLabel(symbols: readonly string[]): string {
  return symbols.map(symbolBase).join(" / ");
}
