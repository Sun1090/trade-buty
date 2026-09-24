/**
 * R16.163：一个界面在两处说话不一致。
 *
 * 底部导航（`t.nav.*`）早就把三个入口叫「行情 / 回放 / 学习路线」，页面自己上方的眉标
 * 却写着 `"Practice"`（图表页与回放页一模一样）和 `"Learning Path"`——中文页上整串英文，
 * 而且两页共用一个名字，等于什么都没指。en 侧同理：`path.label` 与 `path.title` 逐字相同，
 * chart / replay 两页的眉标也撞成 "Practice"。
 *
 * 口径：眉标就是导航里给同一条 href 用的那个名字，单一所有者是 `nav.*`；字典里所有
 * 中文眉标都必须含中文。渲染侧由 `src/app/[locale]/path/lessons-unit.test.tsx` 钉住，
 * 这里查的是字典本身（三处眉标都是逐字渲染的字段）。
 */
import { describe, expect, it } from "vitest";
import { getDict } from "./i18n";

const CJK = /[一-鿿]/;

/** 眉标与 `nav.*` 同名的那几个区块（各自对应一条导航项） */
const NAV_NAMED = ["path", "chart", "replay"] as const;

function labelSections(locale: "zh" | "en"): [string, string][] {
  const dict = getDict(locale) as unknown as Record<string, { label?: unknown }>;
  return Object.entries(dict)
    .filter(([, value]) => typeof value?.label === "string")
    .map(([key, value]) => [key, value.label as string]);
}

describe("中文眉标不整串英文", () => {
  it("中文字典里每一个区块眉标都含中文", () => {
    const rows = labelSections("zh");
    // 地板：某处把 label 改名或删掉时，这条扫描会缩水而不是安静通过（R16.113 的口径）
    expect(rows.length, "中文眉标只扫到这些：" + rows.map(([k]) => k).join(", ")).toBeGreaterThanOrEqual(7);
    for (const [key, label] of rows) {
      expect(label, `zh.${key}.label 又是整串英文`).toMatch(CJK);
    }
  });

  it("禁令抓得住旧写法", () => {
    for (const legacy of ["Practice", "Learning Path"]) {
      expect(CJK.test(legacy), `${legacy} 本身含中文，上面那条断言是空转`).toBe(false);
    }
  });
});

describe("眉标的名字就是导航里的那个名字", () => {
  for (const locale of ["zh", "en"] as const) {
    it(`${locale}：三处眉标逐字等于对应导航项`, () => {
      const dict = getDict(locale);
      for (const key of NAV_NAMED) {
        expect(dict[key].label, `${locale} 的 ${key}.label 又和 nav.${key} 分家了`).toBe(
          dict.nav[key],
        );
      }
    });
  }

  it("导航里这三个名字彼此不同（否则「等于导航名」可以是句空话）", () => {
    for (const locale of ["zh", "en"] as const) {
      const names = NAV_NAMED.map((key) => getDict(locale).nav[key]);
      expect(new Set(names).size, `${locale} 的导航名撞了：${names.join(" / ")}`).toBe(names.length);
      const labels = NAV_NAMED.map((key) => getDict(locale)[key].label);
      expect(new Set(labels).size, `${locale} 的眉标撞了：${labels.join(" / ")}`).toBe(labels.length);
    }
  });

  it("en 的路线页眉标不再逐字复读自己的 h1", () => {
    const dict = getDict("en");
    expect(dict.path.label).not.toBe(dict.path.title);
  });
});

describe("数课文的量词只有一个", () => {
  for (const locale of ["zh", "en"] as const) {
    it(`${locale}：路线页与篇章页用同一个字段词`, () => {
      const dict = getDict(locale);
      expect(dict.path.lessonsUnit).toBe(dict.chapter.lessonsUnit);
      // 「篇章」是上一层的对象，拿来数课文就是把两个名字又并成一个
      expect(dict.path.lessonsUnit).not.toMatch(/篇|chapter/i);
    });
  }
});
