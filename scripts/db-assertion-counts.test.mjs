import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { auditDocCitations, pickSections, readPlanCounts, run } from "./db-assertion-counts.mjs";

const plans = () => new Map([["rls_isolation", 40], ["sync_and_constraints", 30], ["embedding_generations", 8]]);

/** 一篇文档里三个 plan 的引用全对，用来隔离「文档缺席」这条分支。 */
const CONSISTENT = [
  "### `sync_and_constraints.sql`（pgTAP，30 条断言）",
  "（`rls_isolation` 40 + `sync_and_constraints` 30 + `embedding_generations` 8 条断言）",
].join("\n");

/**
 * roadmap 的形状：`## Q…` 是现行计划（要核对），`## R…` 之后是逐轮台账（R16.268 那行会
 * 把被改掉的旧数字原文引一遍当证据，整篇扫会把那句真话报成不符）。
 */
const roadmapDoc = (qBody, ledgerBody) =>
  ["## Q2 质量门禁", qBody, "", "## R16 学习数据口径（盘点进行中）", ledgerBody].join("\n");
const LEDGER_QUOTE = "- [x] R16.268 原文那句聚合是 `sync_and_constraints.sql`（26 条断言）、重跑 pgTAP(40+26+8 断言)，本轮改掉";

/** 造一个最小可过的仓库：supabase/tests 里三个 plan，AUDITED_DOCS 那两篇文档引用一致。 */
function fixtureRepo({ dropDoc, qBody, ledgerBody } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "db-assertion-counts-"));
  fs.mkdirSync(path.join(root, "supabase/tests"), { recursive: true });
  fs.writeFileSync(path.join(root, "supabase/tests/rls_isolation.sql"), "select plan(40);\n");
  fs.writeFileSync(path.join(root, "supabase/tests/sync_and_constraints.sql"), "select plan(30);\n");
  fs.writeFileSync(path.join(root, "supabase/tests/embedding_generations.sql"), "select plan(8);\n");
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  for (const doc of ["database-testing.md", "roadmap.md"]) {
    if (doc === dropDoc) continue;
    fs.writeFileSync(
      path.join(root, "docs", doc),
      doc === "roadmap.md"
        ? roadmapDoc(qBody ?? CONSISTENT, ledgerBody ?? LEDGER_QUOTE)
        : CONSISTENT,
    );
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

describe("pickSections（R16.268：一篇文档里的现行节与逐轮台账）", () => {
  it("只留下标题匹配的那几节，其余整节丢掉", () => {
    const text = ["## 开头", "不要我", "## Q2 门禁", "要我 A", "", "## R16 台账", "不要我 B", "## Q5 卫生", "要我 C"].join("\n");
    expect(pickSections(text, /^## Q/).split("\n")).toEqual(["## Q2 门禁", "要我 A", "", "## Q5 卫生", "要我 C"]);
  });

  it("真实 roadmap：Q2.8 / Q5.4 那两行在节选之后仍然在场，台账行不在", () => {
    const text = fs.readFileSync(path.resolve(process.cwd(), "docs/roadmap.md"), "utf8");
    const picked = pickSections(text, /^## Q/);
    expect(picked).toContain("`rls_isolation.sql`（跨用户隔离与越权写入，44 条断言）");
    expect(picked).toContain("重跑 pgTAP(44+34+8 断言)");
    expect(picked.includes("R16.268"), "台账行漏进来了：它引用的旧数字会被报成不符").toBe(false);
    expect(picked.includes("40+30+8"), "台账里那句「原文是 40+30+8」必须留在节选之外").toBe(false);
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

  it("R16.268：台账节把被改掉的旧数字原文引一遍，不算不符（现行 Q 节照旧核对）", () => {
    const root = fixtureRepo();
    try {
      const text = fs.readFileSync(path.join(root, "docs/roadmap.md"), "utf8");
      expect(text, "夹具没造出台账引用旧数字的形状，这条就不是那条回归").toContain("（26 条断言）");
      const sink = collect();
      run({ root, log: sink.log, exit: sink.exit });
      expect(sink.codes).toEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("同一个错数字写在 Q 节里就仍然要报——节选不是免罪金牌", () => {
    const root = fixtureRepo({ qBody: "- `sync_and_constraints.sql`（26 条断言）已跑通" });
    try {
      const sink = collect();
      run({ root, log: sink.log, exit: sink.exit });
      expect(sink.codes).toEqual([1]);
      expect(sink.lines.join("\n")).toContain("文档写 26");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("roadmap 里一节 Q 都没有就失败，而不是把空集合读成「没有不符」", () => {
    const root = fixtureRepo({ qBody: "", ledgerBody: LEDGER_QUOTE });
    try {
      const sink = collect();
      run({ root, log: sink.log, exit: sink.exit });
      expect(sink.codes).toEqual([1]);
      expect(sink.lines.join("\n")).toContain("只剩标题");
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
