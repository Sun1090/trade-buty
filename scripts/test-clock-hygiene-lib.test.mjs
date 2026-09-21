import { describe, expect, it } from "vitest";
import {
  analyzeTestClockHygiene,
  escapeTableCell,
  isSelfFixture,
  renderClockHygieneMarkdown,
  shouldFailClockHygiene,
  summarizeClockHygiene,
} from "./test-clock-hygiene-lib.mjs";

const kinds = (result) => result.findings.map((finding) => finding.kind);

describe("shouldFailClockHygiene", () => {
  it("只有 clock-in-assertion 阻断，未受控定时器保持报告式", () => {
    expect(shouldFailClockHygiene({})).toBe(false);
    expect(shouldFailClockHygiene({ "uncontrolled-timer": 10 })).toBe(false);
    expect(shouldFailClockHygiene({ "clock-in-assertion": 1 })).toBe(true);
    expect(shouldFailClockHygiene(undefined)).toBe(false);
  });
});

describe("isSelfFixture", () => {
  it("只排除巡检器自己的夹具文件，并容忍 ./ 前缀", () => {
    expect(isSelfFixture("scripts/test-clock-hygiene-lib.test.mjs")).toBe(true);
    expect(isSelfFixture("./scripts/test-clock-hygiene-lib.test.mjs")).toBe(true);
    expect(isSelfFixture("src/lib/last-visit.test.ts")).toBe(false);
    expect(isSelfFixture(undefined)).toBe(false);
  });
});

describe("analyzeTestClockHygiene", () => {
  it("干净的测试不产生命中", () => {
    const result = analyzeTestClockHygiene({
      file: "src/lib/clean.test.ts",
      source: `
        import { expect, it } from "vitest";
        it("adds", () => { expect(1 + 1).toBe(2); });
      `,
    });
    expect(result.findings).toEqual([]);
  });

  it("点名「断言直接读墙钟」，包括把两个时钟读数相减的写法", () => {
    const elapsed = analyzeTestClockHygiene({
      file: "src/lib/slow.test.ts",
      source: `
        const t0 = Date.now();
        doWork();
        expect(Date.now() - t0).toBeLessThan(500);
      `,
    });
    expect(kinds(elapsed)).toEqual(["clock-in-assertion"]);
    expect(elapsed.findings[0].line).toBe(4);
    expect(elapsed.findings[0].text).toContain("toBeLessThan(500)");

    const cached = analyzeTestClockHygiene({
      file: "src/lib/cached.test.ts",
      source: `expect(cached.at).toBeLessThanOrEqual(Date.now());`,
    });
    expect(kinds(cached)).toEqual(["clock-in-assertion"]);
  });

  it("跨行的 expect 语句也算一次，不重复计数", () => {
    const result = analyzeTestClockHygiene({
      file: "src/lib/multiline.test.ts",
      source: `
        expect(
          summarize({ now: performance.now() })
        ).toEqual({ ok: true });
      `,
    });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].line).toBe(2);
  });

  it("真实定时器只在同文件从不使用受控时钟时命中", () => {
    const uncontrolled = analyzeTestClockHygiene({
      file: "src/components/tour.test.tsx",
      source: `await new Promise((r) => setTimeout(r, 0));`,
    });
    expect(kinds(uncontrolled)).toEqual(["uncontrolled-timer"]);

    const controlled = analyzeTestClockHygiene({
      file: "src/components/fake.test.tsx",
      source: `
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-09-22T00:00:00Z"));
        setTimeout(flush, 10);
        vi.advanceTimersByTime(10);
      `,
    });
    expect(controlled.findings).toEqual([]);
  });

  it("缺参数时按空处理", () => {
    expect(analyzeTestClockHygiene().findings).toEqual([]);
    expect(summarizeClockHygiene()).toEqual({
      "clock-in-assertion": 0,
      "uncontrolled-timer": 0,
    });
  });
});

describe("renderClockHygieneMarkdown", () => {
  const results = [
    {
      file: "src/lib/a.test.ts",
      findings: [{ kind: "clock-in-assertion", line: 3, text: "expect(Date.now()).toBe(1);" }],
    },
    { file: "src/lib/b.test.ts", findings: [] },
    {
      file: "src/lib/c.test.ts",
      findings: [{ kind: "uncontrolled-timer", line: 9, text: "setTimeout(r, 0)" }],
    },
  ];

  it("列出命中文件并给出汇总计数", () => {
    const markdown = renderClockHygieneMarkdown({
      generatedAt: "2026-09-22",
      scanned: 3,
      results,
    });
    expect(markdown).toContain("扫描测试文件：3 个，命中文件：2 个");
    expect(markdown).toContain("clock-in-assertion：1");
    expect(markdown).toContain("uncontrolled-timer：1");
    expect(markdown).toContain("src/lib/a.test.ts");
    expect(markdown).toContain("src/lib/c.test.ts");
    expect(markdown).not.toContain("| src/lib/b.test.ts |");
  });

  it("没有命中时输出明确结论，且表格行里的竖线被转义", () => {
    const empty = renderClockHygieneMarkdown({ generatedAt: "2026-09-22", scanned: 1, results: [] });
    expect(empty).toContain("没有发现依赖未受控时钟的断言或定时器");
    expect(empty).not.toContain("| 口径 | 文件 |");

    const pipe = renderClockHygieneMarkdown({
      generatedAt: "2026-09-22",
      scanned: 1,
      results: [
        {
          file: "src/lib/p.test.ts",
          findings: [{ kind: "clock-in-assertion", line: 1, text: "expect(a | b).toBe(Date.now())" }],
        },
      ],
    });
    expect(pipe).toContain("a &#124; b");
    expect(pipe).not.toContain("a \| b");
  });
});

describe("escapeTableCell", () => {
  it("转义 &、反斜杠与竖线，且顺序保证实体不被二次编码", () => {
    expect(escapeTableCell("a | b")).toBe("a &#124; b");
    expect(escapeTableCell("a \\ b")).toBe("a &#92; b");
    expect(escapeTableCell("a & b")).toBe("a &amp; b");
    // 原文里已存在的实体要原样可见，不能被解码后又叠成新实体
    expect(escapeTableCell("&amp;")).toBe("&amp;amp;");
    // 反斜杠紧跟竖线时，只替竖线会把表格单元格撑破
    expect(escapeTableCell("\\|")).toBe("&#92;&#124;");
    expect(escapeTableCell(undefined)).toBe("");
    expect(escapeTableCell(null)).toBe("");
  });
});
