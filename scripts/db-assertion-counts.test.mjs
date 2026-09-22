import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { auditDocCitations, readPlanCounts } from "./db-assertion-counts.mjs";

const plans = () => new Map([["rls_isolation", 40], ["sync_and_constraints", 30], ["embedding_generations", 8]]);

describe("readPlanCounts", () => {
  it("从真实仓库的 pgTAP 文件读出每个文件的 plan", () => {
    const read = readPlanCounts(path.resolve(process.cwd(), "supabase/tests"));
    expect([...read.keys()].sort()).toEqual([
      "embedding_generations",
      "rls_isolation",
      "sync_and_constraints",
    ]);
    for (const value of read.values()) expect(value).toBeGreaterThan(0);
  });

  it("非 pgTAP 的 sql（没有 plan）不进入清单", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pgtap-"));
    fs.writeFileSync(path.join(dir, "rls_isolation.sql"), "select plan(40);\nselect ok(1=1);\n");
    fs.writeFileSync(path.join(dir, "0001_init.sql"), "create table t(id int);\n");
    expect([...readPlanCounts(dir).entries()]).toEqual([["rls_isolation", 40]]);
  });
});

describe("auditDocCitations", () => {
  it("文件名后面的断言数与 plan 不符即报", () => {
    const issues = auditDocCitations({
      plans: plans(),
      docs: [{ file: "docs/roadmap.md", text: "双设备同步/约束 `sync_and_constraints.sql`（26 条断言）已跑通" }],
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].detail).toContain("文档写 26");
    expect(issues[0].detail).toContain("plan 是 30");
  });

  it("聚合写法「40+26+8 断言」按集合比对，单个数字对不上也算不符", () => {
    const issues = auditDocCitations({
      plans: plans(),
      docs: [{ file: "docs/roadmap.md", text: "重跑 pgTAP(40+26+8 断言)" }],
    });
    expect(issues[0].detail).toContain("40+26+8");
  });

  it("引用一致时不报；历史条目式句子也不会误报成不符", () => {
    const docs = [
      {
        file: "docs/database-testing.md",
        text:
          "### `sync_and_constraints.sql`（pgTAP，30 条断言）\n" +
          "（`rls_isolation` 40 + `sync_and_constraints` 30 + `embedding_generations` 8 条断言）\n",
      },
    ];
    expect(auditDocCitations({ plans: plans(), docs })).toEqual([]);
  });
});
