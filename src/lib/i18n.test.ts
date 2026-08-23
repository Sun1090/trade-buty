import { describe, it, expect } from "vitest";
import { getDict, isLocale, LOCALES, DEFAULT_LOCALE } from "./i18n";

describe("i18n", () => {
  it("isLocale 识别有效 locale", () => {
    expect(isLocale("zh")).toBe(true);
    expect(isLocale("en")).toBe(true);
  });

  it("isLocale 拒绝无效 locale", () => {
    expect(isLocale("ja")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale("ZH")).toBe(false);
  });

  it("LOCALES 只含 zh 和 en", () => {
    expect(LOCALES).toEqual(["zh", "en"]);
  });

  it("DEFAULT_LOCALE 是 en", () => {
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it("getDict('zh') 返回中文字典", () => {
    const d = getDict("zh");
    expect(d.brand.name).toBe("Trade Buty");
    expect(d.nav.path).toBeTruthy();
  });

  it("getDict('en') 返回英文字典", () => {
    const d = getDict("en");
    expect(d.brand.name).toBe("Trade Buty");
    expect(d.nav.path).toBeTruthy();
  });

  it("getDict 无效 locale 回退到 DEFAULT_LOCALE", () => {
    const d = getDict("ja" as never);
    // 应回退到 en
    expect(d.nav.path).toBe(getDict("en").nav.path);
  });

  it("zh 和 en 的 nav 键一致", () => {
    const zhKeys = Object.keys(getDict("zh").nav);
    const enKeys = Object.keys(getDict("en").nav);
    expect(zhKeys).toEqual(enKeys);
  });
});
