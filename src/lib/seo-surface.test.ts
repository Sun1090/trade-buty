import { describe, expect, it } from "vitest";
import {
  INDEXABLE_STATIC_SURFACES,
  NOINDEX_STATIC_PATHS,
  ROBOTS_DISALLOW,
} from "./seo-surface";

/**
 * R13.17：声明本身的不变量。语义级复核（产物 vs 声明）在
 * `scripts/seo-surface-lib.test.mjs` 与 `npm run check:seo-surface`。
 */
describe("seo-surface 声明", () => {
  it("首页在可索引集合内", () => {
    expect(INDEXABLE_STATIC_SURFACES.map((s) => s.path)).toContain("");
  });

  it("可索引路径以 / 开头（首页除外）且不以 / 结尾", () => {
    for (const surface of INDEXABLE_STATIC_SURFACES) {
      if (surface.path !== "") expect(surface.path.startsWith("/")).toBe(true);
      expect(surface.path.endsWith("/")).toBe(false);
    }
  });

  it("priority 落在 0–1 且路径唯一", () => {
    const paths = INDEXABLE_STATIC_SURFACES.map((s) => s.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const surface of INDEXABLE_STATIC_SURFACES) {
      expect(surface.priority).toBeGreaterThan(0);
      expect(surface.priority).toBeLessThanOrEqual(1);
    }
  });

  it("没有路径同时出现在可索引与 noindex 两个集合", () => {
    const overlap = INDEXABLE_STATIC_SURFACES.map((s) => s.path).filter((p) =>
      NOINDEX_STATIC_PATHS.includes(p),
    );
    expect(overlap).toEqual([]);
  });

  it("noindex 集合无重复且都是绝对路径", () => {
    expect(new Set(NOINDEX_STATIC_PATHS).size).toBe(NOINDEX_STATIC_PATHS.length);
    for (const p of NOINDEX_STATIC_PATHS) expect(p.startsWith("/")).toBe(true);
  });

  it("学习仪表盘 /stats 明确 noindex（本地数据页面不做收录）", () => {
    expect(NOINDEX_STATIC_PATHS).toContain("/stats");
  });

  it("robots 规则不重复", () => {
    expect(new Set(ROBOTS_DISALLOW).size).toBe(ROBOTS_DISALLOW.length);
  });
});
