import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sameReportContent, writeReport } from "./report-write-lib.mjs";

let dir;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "report-write-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("sameReportContent", () => {
  it("treats a date-only difference as unchanged", () => {
    expect(
      sameReportContent("# 报告\n> 2026-09-21 生成\n- 计数 418", "# 报告\n> 2026-09-22 生成\n- 计数 418")
    ).toBe(true);
  });

  it("detects a real content change", () => {
    expect(sameReportContent("- 计数 418", "- 计数 419")).toBe(false);
  });

  it("reports a missing file as changed", () => {
    expect(sameReportContent(null, "anything")).toBe(false);
    expect(sameReportContent(undefined, "anything")).toBe(false);
  });

  it("accepts identical content without a date", () => {
    expect(sameReportContent("no dates here", "no dates here")).toBe(true);
  });
});

describe("writeReport", () => {
  it("creates the file on first generation", () => {
    const file = join(dir, "report.md");
    expect(writeReport(file, "> 2026-09-22\n内容 A\n")).toBe("created");
    expect(readFileSync(file, "utf8")).toBe("> 2026-09-22\n内容 A\n");
  });

  it("keeps the previous date when only the date would change", () => {
    const file = join(dir, "report.md");
    writeReport(file, "> 2026-09-20\n内容 A\n");
    expect(writeReport(file, "> 2026-09-22\n内容 A\n")).toBe("unchanged");
    expect(readFileSync(file, "utf8")).toBe("> 2026-09-20\n内容 A\n");
  });

  it("rewrites when the content really changed", () => {
    const file = join(dir, "report.md");
    writeReport(file, "> 2026-09-20\n内容 A\n");
    expect(writeReport(file, "> 2026-09-22\n内容 B\n")).toBe("updated");
    expect(readFileSync(file, "utf8")).toBe("> 2026-09-22\n内容 B\n");
  });

  it("overwrites an unrelated existing file", () => {
    const file = join(dir, "report.json");
    writeFileSync(file, "{}\n");
    expect(writeReport(file, '{"generatedAt":"2026-09-22"}\n')).toBe("updated");
  });
});
