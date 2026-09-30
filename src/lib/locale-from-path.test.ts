import { describe, expect, it } from "vitest";
import { localeFromPathname } from "./locale-from-path";

describe("localeFromPathname（R16.41 最小伤害版）", () => {
  it("locale 前缀原样识别", () => {
    expect(localeFromPathname("/zh/nope")).toBe("zh");
    expect(localeFromPathname("/zh")).toBe("zh");
    expect(localeFromPathname("/en/auth/nope")).toBe("en");
  });

  it("locale-less URL 回落默认语言（与 R13.18 的 e2e 同口径）", () => {
    expect(localeFromPathname("/missing-from-search-engine")).toBe("en");
    expect(localeFromPathname("/")).toBe("en");
  });

  it("空值与相对路径回落默认语言，不抛错", () => {
    expect(localeFromPathname(null)).toBe("en");
    expect(localeFromPathname(undefined)).toBe("en");
    expect(localeFromPathname("")).toBe("en");
    expect(localeFromPathname("zh")).toBe("en");
  });
});
