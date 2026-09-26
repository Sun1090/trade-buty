/**
 * 未决 roadmap 项是现在仍要据此做产品/架构决定的活文档，引用必须经得住源码增删行。
 * 已完成项可以保留历史行号；未决项只准引用稳定路径与符号/字段名，不准把会漂的行号
 * 当成事实主人。否则一次无关格式化就会让「证据」指向括号、空行或另一段实现。
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const roadmap = readFileSync(path.join(root, "docs/roadmap.md"), "utf8");
const openRows = roadmap.split("\n").filter((line) => line.startsWith("- [ ]"));
const sourceRef = /`((?:src|scripts|docs|e2e|supabase)\/[^`\s:]+\.(?:ts|tsx|mjs|md|sql|json|yml|yaml))(?:[:#]L?\d+(?:[-,]\d+)*)?`/g;
const lineRef = /`(?:[^`\s:]+\/)?[^`\s:]+\.(?:ts|tsx|mjs|md|sql|json|yml|yaml)(?:[:#]L?\d+(?:[-,]\d+)*)`|`:\d+(?:[-,]\d+)*`/g;
const intentionalAbsentExamples = new Set([
  "src/app/[locale]/[...rest]/page.tsx",
  "src/app/[locale]/not-found.tsx",
]);

describe("未决 roadmap 引用使用稳定主人", () => {
  it("未决项不把源码行号当主人", () => {
    const unstable = openRows.flatMap((row) => [...row.matchAll(lineRef)].map((m) => m[0]));
    expect(unstable, `未决项仍有会漂移的行号引用：${unstable.join("、")}`).toEqual([]);
  });

  it("未决项点名的具体仓库路径全部存在", () => {
    const refs = openRows.flatMap((row) => [...row.matchAll(sourceRef)].map((m) => m[1]));
    expect(refs.length, "未决项一个源码/文档路径都没有，扫描很可能空转").toBeGreaterThanOrEqual(10);
    const concreteRefs = [...new Set(refs)].filter((rel) => !rel.includes("*"));
    const missing = concreteRefs.filter(
      (rel) => !intentionalAbsentExamples.has(rel) && !existsSync(path.join(root, rel)),
    );
    expect(missing, `未决项引用了不存在的路径：${missing.join("、")}`).toEqual([]);
  });

  it("仅豁免 R16.41 明说试过但未采用的两个路由", () => {
    for (const rel of intentionalAbsentExamples) {
      expect(roadmap).toContain(`\`${rel}\``);
      expect(existsSync(path.join(root, rel)), `${rel} 若已落地就应移出豁免`).toBe(false);
    }
  });
});
