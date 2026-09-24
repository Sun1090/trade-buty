import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { auditDocCitations, readPlanCounts, run } from "./db-assertion-counts.mjs";

const plans = () => new Map([["rls_isolation", 40], ["sync_and_constraints", 30], ["embedding_generations", 8]]);

/** 一篇文档里三个 plan 的引用全对，用来隔离「文档缺席」这条分支。 */
const CONSISTENT = [
  "### `sync_and_constraints.sql`（pgTAP，30 条断言）",
  "（`rls_isolation` 40 + `sync_and_constraints` 30 + `embedding_generations` 8 条断言）",
].join("\n");

/** 造一个最小可过的仓库：supabase/tests 里三个 plan，AUDITED_DOCS 那两篇文档引用一致。 */
function fixtureRepo({ dropDoc } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "db-assertion-counts-"));
  fs.mkdirSync(path.join(root, "supabase/tests"), { recursive: true });
  fs.writeFileSync(path.join(root, "supabase/tests/rls_isolation.sql"), "select plan(40);\n");
  fs.writeFileSync(path.join(root, "supabase/tests/sync_and_constraints.sql"), "select plan(30);\n");
  fs.writeFileSync(path.join(root, "supabase/tests/embedding_generations.sql"), "select plan(8);\n");
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  for (const doc of ["database-testing.md", "roadmap.md"]) {
    if (doc === dropDoc) continue;
    fs.writeFileSync(path.join(root, "docs", doc), CONSISTENT);
  }
  return root;
}

const collect = () => {
  const lines = [];
  const codes = [];
  return {
    lines,
    codes,
    log: (message) => lines.push(String(message)),
    exit: (code) => codes.push(code),
  };
};

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

describe("run（R16.83 扫描范围本身）", () => {
  it("引用一致且两篇文档都在：通过", () => {
    const root = fixtureRepo();
    try {
      const sink = collect();
      run({ root, log: sink.log, exit: sink.exit });
      expect(sink.codes).toEqual([]);
      expect(sink.lines.join("\n")).toContain("audit passed");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("被对账的文档少一篇就失败，并且点名是哪一篇", () => {
    const root = fixtureRepo({ dropDoc: "roadmap.md" });
    try {
      const sink = collect();
      run({ root, log: sink.log, exit: sink.exit });
      expect(sink.codes).toEqual([1]);
      expect(sink.lines.join("\n")).toContain("docs/roadmap.md");
      expect(sink.lines.join("\n")).toContain("只扫到 1 个");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("pgTAP 目录整个不见了也失败，而不是让 readdirSync 抛一句读不懂的错", () => {
    const root = fixtureRepo();
    try {
      fs.rmSync(path.join(root, "supabase"), { recursive: true, force: true });
      const sink = collect();
      run({ root, log: sink.log, exit: sink.exit });
      expect(sink.codes).toEqual([1]);
      expect(sink.lines.join("\n")).toContain("找不到 pgTAP 目录");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("仓库现状：两篇现行文档都读得到，跑一遍不改任何文件就通过", () => {
    const sink = collect();
    run({ root: path.resolve(process.cwd()), log: sink.log, exit: sink.exit });
    expect(sink.codes).toEqual([]);
  });
});
