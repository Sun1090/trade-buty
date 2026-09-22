/**
 * 币种清单的口径门禁：「支持哪些币」这句话在 FAQ、图表按钮、回放选项、首页行情条四处出现。
 * 一旦某处自己写死一份，改另一处就没人想得起来——曾经就是这样：FAQ 写「四个币种」，
 * 而图表允许输入任意 USDT 交易对，行情条又只列 3 个。这里把「清单只有一个来源」钉住。
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHART_CUSTOM_SYMBOL,
  CHART_QUICK_SYMBOLS,
  REPLAY_SYMBOLS,
  TICKER_SYMBOLS,
  sameSymbolSet,
  symbolBase,
  symbolListLabel,
} from "./chart-symbols";

function read(...parts: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

/** 旧文案长什么样：门禁的每条正则都要先证明它能抓住这一句 */
const LEGACY_COPY = "是的，使用 Binance 公开 API 获取实时 K 线数据，支持 BTC/ETH/BNB/SOL 四个币种。";

const LISTS: Record<string, readonly string[]> = {
  CHART_QUICK_SYMBOLS,
  REPLAY_SYMBOLS,
  TICKER_SYMBOLS,
};

describe("行情标的清单", () => {
  it("三份清单都非空，且互不重复", () => {
    for (const [name, list] of Object.entries(LISTS)) {
      expect(list.length, `${name} 不能是空的`).toBeGreaterThan(0);
      expect(new Set(list).size, `${name} 有重复标的`).toBe(list.length);
    }
    expect(CHART_QUICK_SYMBOLS.length, "快捷按钮应与清单同长").toBe(4);
  });

  it("清单里的每个标的都是图表打得开的 USDT 交易对", () => {
    for (const [name, list] of Object.entries(LISTS)) {
      for (const symbol of list) {
        expect(CHART_CUSTOM_SYMBOL.test(symbol), `${name} 的 ${symbol} 图表打不开`).toBe(true);
      }
    }
  });

  it("行情条与回放只能展示快捷按钮已经给出过的标的", () => {
    // 首页行情条点进去就是练习图表：宣传一个练习页要手敲才能打开的币，等于把用户送到死角
    const quick: readonly string[] = CHART_QUICK_SYMBOLS;
    expect(TICKER_SYMBOLS.filter((s) => !quick.includes(s))).toEqual([]);
    expect(REPLAY_SYMBOLS.filter((s) => !quick.includes(s))).toEqual([]);
  });

  it("同一批标的的判定与顺序无关、与长度有关", () => {
    expect(sameSymbolSet(["BTCUSDT", "ETHUSDT"], ["ETHUSDT", "BTCUSDT"])).toBe(true);
    expect(sameSymbolSet(["BTCUSDT"], ["BTCUSDT", "ETHUSDT"])).toBe(false);
    expect(sameSymbolSet(["BTCUSDT", "ETHUSDT"], ["BTCUSDT"])).toBe(false);
    // 今天的事实：回放的清单与图表快捷按钮完全一致
    expect(sameSymbolSet(REPLAY_SYMBOLS, CHART_QUICK_SYMBOLS)).toBe(true);
  });

  it("短标只去掉结尾的计价货币", () => {
    expect(symbolBase("BTCUSDT")).toBe("BTC");
    expect(symbolBase("1INCHUSDT")).toBe("1INCH");
    // 旧实现用的是不带锚点的 replace("USDT","")，会把 USDTUSDT 这类开头的也吃掉
    expect(symbolBase("USDTUSD")).toBe("USDTUSD");
    expect(symbolListLabel(["BTCUSDT", "ETHUSDT"])).toBe("BTC / ETH");
  });
});

describe("自定义交易对的接受范围", () => {
  it("接受快捷清单之外的 USDT 币对（FAQ 据此声称「任意 USDT 计价的现货交易对」）", () => {
    expect(CHART_CUSTOM_SYMBOL.test("XRPUSDT")).toBe(true);
    // 币安现货里有以数字开头的标的，所以校验不能只允许字母
    expect(CHART_CUSTOM_SYMBOL.test("1INCHUSDT")).toBe(true);
  });

  it("拒绝非 USDT 计价与空串", () => {
    for (const bad of ["BTCUSD", "DOGE", "USDT", "", "1INCH"]) {
      expect(CHART_CUSTOM_SYMBOL.test(bad), `${bad} 不该被接受`).toBe(false);
    }
  });
});

describe("币种名字只有一个来源", () => {
  const consumers: Array<[string[], string]> = [
    [["src", "components", "kline-chart.tsx"], "CHART_QUICK_SYMBOLS"],
    [["src", "components", "replay-trainer.tsx"], "REPLAY_SYMBOLS"],
    [["src", "components", "market-ticker.tsx"], "TICKER_SYMBOLS"],
    [["src", "app", "[locale]", "faq", "page.tsx"], "CHART_QUICK_SYMBOLS"],
  ];

  it("消费方都从 chart-symbols 取清单，没有自带的副本", () => {
    expect(consumers.length, "扫描清单本身不能为空").toBeGreaterThan(3);
    for (const [parts, imported] of consumers) {
      const file = path.join(...parts);
      const src = read(...parts);
      expect(src, `${file} 必须引用清单常量`).toContain(`@/lib/chart-symbols`);
      expect(src, `${file} 必须用到 ${imported}`).toContain(imported);
      expect(src, `${file} 又自己写了一份标的数组`).not.toMatch(/const\s+SYMBOLS\s*=\s*\[/);
    }
  });

  it("界面代码里不再出现写死的交易对字面量", () => {
    const offenders: string[] = [];
    for (const [parts] of consumers) {
      const src = read(...parts);
      for (const m of src.matchAll(/"[A-Z0-9]*USDT"/g)) {
        offenders.push(`${path.join(...parts)}: ${m[0]}`);
      }
    }
    expect(offenders, `默认值/校验请从清单取：\n${offenders.join("\n")}`).toEqual([]);
    // 非空转：门禁抓得住旧的默认值写法
    expect(/"[A-Z0-9]*USDT"/.test('useState<string>("BTCUSDT")')).toBe(true);
  });

  it("面向用户的文案不再枚举币种名，只能由清单生成", () => {
    const copyFiles = [
      read("src", "app", "[locale]", "faq", "page.tsx"),
      read("src", "lib", "i18n.ts"),
      read("src", "app", "[locale]", "page.tsx"),
    ];
    expect(copyFiles.length).toBe(3);
    for (const src of copyFiles) {
      expect(src).not.toMatch(/BTC\s*\/\s*ETH|四个币种|4\s*(?:个)?\s*(?:coins|currencies)/);
    }
    expect(/BTC\s*\/\s*ETH|四个币种/.test(LEGACY_COPY), "门禁必须抓得住旧文案").toBe(true);
    // 文案引用的就是这份清单本身
    expect(read("src", "app", "[locale]", "faq", "page.tsx")).toContain(
      "symbolListLabel(CHART_QUICK_SYMBOLS)",
    );
  });
});
