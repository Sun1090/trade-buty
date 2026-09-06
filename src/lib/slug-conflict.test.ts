import { describe, expect, it } from "vitest";
import {
  README,
  stripNumericPrefix,
  identityKey,
  isLegalSlug,
  findIdentityConflicts,
  crossLocaleSlugConflicts,
} from "../../scripts/slug-conflict-lib.mjs";

describe("slug-conflict lib (R10.14)", () => {
  it("stripNumericPrefix 只去掉前导数字与一个连字符/下划线", () => {
    expect(stripNumericPrefix("01-foo")).toBe("foo");
    expect(stripNumericPrefix("01_foo")).toBe("foo");
    expect(stripNumericPrefix("foo")).toBe("foo");
    expect(stripNumericPrefix("1x-foo")).toBe("1x-foo");
    expect(stripNumericPrefix("1-x")).toBe("x");
  });

  it("identityKey 折叠大小写与前缀", () => {
    expect(identityKey("01-Foo")).toBe("foo");
    expect(identityKey("Foo-Bar")).toBe("foo-bar");
  });

  it("isLegalSlug 只放行小写字母数字连字符", () => {
    expect(isLegalSlug("candlestick-basics")).toBe(true);
    expect(isLegalSlug("01-foo")).toBe(true);
    expect(isLegalSlug("止损")).toBe(false);
    expect(isLegalSlug("Foo")).toBe(false);
    expect(isLegalSlug("foo bar")).toBe(false);
  });

  it("干净 slug 集合无冲突", () => {
    const clean = ["a", "b-c", "d.md".replace(".md", "")].map((s) => s);
    expect(findIdentityConflicts([...clean, README])).toEqual([]);
  });

  it("检出大小写折叠冲突（README 豁免）", () => {
    const r = findIdentityConflicts(["Foo", "foo", README]);
    expect(r).toHaveLength(1);
    expect(r[0].why).toBe("case-fold");
    expect([r[0].a, r[0].b]).toEqual(expect.arrayContaining(["Foo", "foo"]));
  });

  it("检出数字前缀变体冲突", () => {
    const r = findIdentityConflicts(["01-foo", "foo", "02-bar"]);
    expect(r).toHaveLength(1);
    expect(r[0].why).toBe("numeric-prefix");
    expect(r[0].a).toBe("01-foo");
    expect(r[0].b).toBe("foo");
  });

  it("中文/大写等非法 slug 单独暴露（不靠 findIdentityConflicts）", () => {
    expect(isLegalSlug("止损")).toBe(false);
    expect(isLegalSlug("K线")).toBe(false);
  });

  it("双语一致 slug 无跨语言冲突", () => {
    const zh = ["a", "b", "c"];
    const en = ["a", "b", "c"];
    expect(crossLocaleSlugConflicts(zh, en)).toEqual([]);
  });

  it("en 子集（逐步补齐）不算冲突，只缺篇目", () => {
    const zh = ["a", "b", "c"];
    const en = ["a", "c"];
    expect(crossLocaleSlugConflicts(zh, en)).toEqual([]);
  });

  it("同课中英 slug 不同（01-foo vs foo）→ 冲突", () => {
    const r = crossLocaleSlugConflicts(["01-foo", "bar"], ["foo", "bar"]);
    expect(r).toEqual([
      { zh: "01-foo", en: "foo", why: "slug-mismatch" },
    ]);
  });

  it("纯大小写差异也判为跨语言冲突", () => {
    const r = crossLocaleSlugConflicts(["Foo"], ["foo"]);
    expect(r).toHaveLength(1);
    expect(r[0].zh).toBe("Foo");
  });
});
