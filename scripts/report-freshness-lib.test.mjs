import { describe, expect, it } from "vitest";
import {
  assessFreshness,
  collectReportInventory,
  collectReportProducers,
  parsePorcelain,
  renderFreshnessFailure,
  shouldFailFreshness,
} from "./report-freshness-lib.mjs";

const WRITE = `
const outputMarkdown = path.join(root, "docs/test-clock-hygiene.md");
const outputJson = path.join(root, "docs/test-clock-hygiene.json");
writeReport(outputMarkdown, markdown);
`;
const SPLIT = `writeReport(path.join(root, "docs", "x.md"), body);`;
const RAW_WRITE = `fs.writeFileSync(path.join(root, "docs/raw.md"), body);`;

describe("collectReportInventory", () => {
  it("takes both path.join shapes from writeReport callers only", () => {
    expect(
      collectReportInventory([
        { file: "a.mjs", source: WRITE },
        { file: "b.mjs", source: SPLIT },
        { file: "c.mjs", source: RAW_WRITE },
      ])
    ).toEqual([
      "docs/test-clock-hygiene.json",
      "docs/test-clock-hygiene.md",
      "docs/x.md",
    ]);
  });

  it("ignores scripts that never call the idempotent writer", () => {
    expect(collectReportInventory([{ file: "c.mjs", source: RAW_WRITE }])).toEqual([]);
    expect(collectReportInventory(undefined)).toEqual([]);
  });
});

describe("collectReportProducers", () => {
  it("maps every reported path back to the script that writes it", () => {
    const producers = collectReportProducers([
      { file: "a.mjs", source: WRITE },
      { file: "b.mjs", source: SPLIT },
      { file: "c.mjs", source: RAW_WRITE },
    ]);
    expect(producers.get("docs/test-clock-hygiene.md")).toEqual(["a.mjs"]);
    expect(producers.get("docs/test-clock-hygiene.json")).toEqual(["a.mjs"]);
    expect(producers.get("docs/x.md")).toEqual(["b.mjs"]);
    expect(producers.get("docs/raw.md")).toBeUndefined();
  });

  it("stays derived from the same scan as the inventory", () => {
    const sources = [
      { file: "a.mjs", source: WRITE },
      { file: "a2.mjs", source: WRITE },
      { file: "b.mjs", source: SPLIT },
    ];
    // 两份视图必须出自同一次扫描：清单里每一份都得有出处，出处也不能多出清单没有的。
    const inventory = collectReportInventory(sources);
    const producers = collectReportProducers(sources);
    expect(inventory).toEqual([...producers.keys()].sort());
    expect(producers.get("docs/test-clock-hygiene.md")).toEqual(["a.mjs", "a2.mjs"]);
  });
});

describe("assessFreshness", () => {
  const inventory = ["docs/a.md", "docs/b.md"];

  it("reports the inventory paths the gate rewrote", () => {
    expect(
      assessFreshness({
        inventory,
        statusOutput: " M docs/a.md\n?? docs/other.md\n",
        tracked: inventory,
      })
    ).toEqual({ stale: ["docs/a.md"], untracked: [] });
  });

  it("reports a report the repository never got", () => {
    expect(
      assessFreshness({ inventory, statusOutput: "", tracked: ["docs/a.md"] })
    ).toEqual({ stale: [], untracked: ["docs/b.md"] });
  });

  it("reads renames by their new path", () => {
    expect(parsePorcelain("R  docs/old.md -> docs/new.md")).toEqual(["docs/new.md"]);
  });
});

describe("shouldFailFreshness", () => {
  const ok = { inventory: ["x", "y"], stale: [], untracked: [], minReports: 2 };

  it("passes a fresh surface and fails a stale one", () => {
    expect(shouldFailFreshness(ok)).toBeNull();
    expect(shouldFailFreshness({ ...ok, stale: ["x"] })).toBe("stale-reports");
    expect(shouldFailFreshness({ ...ok, untracked: ["y"] })).toBe("stale-reports");
  });

  it("fails an empty inventory instead of green-lighting nothing to check", () => {
    // 巡检器自己坏掉时最危险的形态是「零份要核对，全部通过」。
    expect(shouldFailFreshness({ ...ok, inventory: [] })).toBe("inventory-too-small");
  });

  it("names the offending file so CI logs are actionable", () => {
    const text = renderFreshnessFailure({
      reason: "stale-reports",
      inventory: ["docs/a.md"],
      stale: ["docs/a.md"],
      untracked: [],
      minReports: 1,
    });
    expect(text).toContain("docs/a.md");
    // 失败信息要指出去哪儿重算，否则读者只知道「过期了」却不知道是谁写的。
    const hinted = renderFreshnessFailure({
      reason: "stale-reports",
      inventory: ["docs/a.md", "docs/b.md"],
      stale: ["docs/a.md"],
      untracked: ["docs/b.md"],
      minReports: 1,
      producers: new Map([
        ["docs/a.md", ["check-a.mjs"]],
        ["docs/b.md", ["tools/b.mjs"]],
      ]),
      commands: { "check-a.mjs": "check:a-report" },
    });
    expect(hinted).toContain("npm run check:a-report");
    expect(hinted).toContain("node scripts/tools/b.mjs");
    expect(renderFreshnessFailure({ reason: "inventory-too-small", inventory: [], stale: [], untracked: [], minReports: 15 })).toContain(
      "下限 15",
    );
  });
});
