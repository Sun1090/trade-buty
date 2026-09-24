/**
 * R16.185：给图表起名的那几处不许替「实时推送」作保。
 *
 * 这张图的推送是有条件的：`networkQuality !== "online"` 时 socket 根本不开
 * （`kline-chart.tsx` 的 WS effect），慢网那侧页面上还写着「已暂停实时推送」。
 * 于是 en 侧的 `chart.title`（同一个字符串也是 `<title>` 与 OG 标题）写着
 * "Live Market Charts"，等于标题在许诺一件同一条规则下会停的事——中文侧本来写的是
 * 「真实行情图表」，「真实」那半一直成立（数据来自币安现货），所以这轮把 en 拉回和中文
 * 同一件事：命名说「真实」，「实时」只在真的描述推送状态时出现。
 *
 * 口径：
 * - 命名句（标题、眉标、课文侧那块卡片的三行、首页元描述、页脚 tagline）里不许出现
 *   `实时` / `live`；
 * - 反过来，披露句必须继续说自己说的是推送——`chart.slowNetwork` 两头都得留着那个词，
 *   否则这条门禁会被人用「把实时两个字全删」满足掉。
 */
import { describe, expect, it } from "vitest";
import { getDict, LOCALES } from "./i18n";

type Dict = ReturnType<typeof getDict>;

/** 给图表「命名」的那几处，逐条点名 */
function namedPlaces(dict: Dict): [string, string][] {
  return [
    ["chart.title", dict.chart.title],
    ["chart.embedHeading", dict.chart.embedHeading],
    ["doc.practiceTitle", dict.doc.practiceTitle],
    ["doc.practiceBody", dict.doc.practiceBody],
    ["doc.practiceCta", dict.doc.practiceCta],
    ["home.metaDesc", dict.home.metaDesc],
    ["footer.tagline", dict.footer.tagline],
  ];
}

describe("图表的名字不许诺实时", () => {
  for (const locale of LOCALES) {
    it(`${locale}：命名句里不出现「实时 / live」`, () => {
      const dict = getDict(locale);
      for (const [name, text] of namedPlaces(dict)) {
        expect(text, `${locale} 的 ${name} 在替实时推送作保`).not.toMatch(/实时/);
        expect(text, `${locale} 的 ${name} 在替实时推送作保`).not.toMatch(/\blive\b/i);
      }
    });
  }

  it("披露句仍然说的是推送（不许靠删词过门禁）", () => {
    expect(getDict("zh").chart.slowNetwork).toContain("实时");
    expect(getDict("en").chart.slowNetwork.toLowerCase()).toContain("live");
  });
});
