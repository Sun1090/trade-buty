import { describe, expect, it } from "vitest";
import { analyzeRiskWarning, auditFallbackWiring } from "./risk-warning-lib.mjs";

const CHAPTER_STYLE = `
  const showRiskWarningFallback = shouldShowRiskWarningFallback(introContent);
  return (
    <div>
      {showRiskWarningFallback && <RiskWarningNotice locale={locale} />}
    </div>
  );
`;

const DOC_STYLE = `
  return (
    <div>
      {shouldShowRiskWarningFallback(doc.content) && (
        <RiskWarningNotice locale={locale} />
      )}
    </div>
  );
`;

describe("auditFallbackWiring", () => {
  it("accepts both the pre-computed and inline guard styles", () => {
    expect(auditFallbackWiring({ "chapter/page.tsx": CHAPTER_STYLE })).toEqual([]);
    expect(auditFallbackWiring({ "doc/page.tsx": DOC_STYLE })).toEqual([]);
  });

  it("accepts nothing to audit", () => {
    expect(auditFallbackWiring(undefined)).toEqual([]);
    expect(auditFallbackWiring({})).toEqual([]);
  });

  it("fails when the fallback decision is not consulted", () => {
    expect(auditFallbackWiring({ "doc/page.tsx": "<div><RiskWarningNotice /></div>" })).toContain(
      "doc/page.tsx: 未调用 shouldShowRiskWarningFallback，上游缺风险块时不会兜底"
    );
  });

  it("fails when the notice is never rendered", () => {
    expect(
      auditFallbackWiring({ "doc/page.tsx": "shouldShowRiskWarningFallback(doc.content)" })
    ).toContain("doc/page.tsx: 没有渲染 RiskWarningNotice 兜底块");
  });

  it("fails when the notice renders unconditionally and would duplicate compliant content", () => {
    const source = `
      const fallback = shouldShowRiskWarningFallback(doc.content);
      return <div><RiskWarningNotice locale={locale} /></div>;
    `;
    expect(auditFallbackWiring({ "doc/page.tsx": source })).toContain(
      "doc/page.tsx: RiskWarningNotice 没有受兜底条件保护，合规内容会重复展示风险提示"
    );
  });

  it("reports every broken page at once", () => {
    expect(
      auditFallbackWiring({ "a.tsx": "", "b.tsx": "" })
    ).toHaveLength(2);
  });
});

describe("analyzeRiskWarning", () => {
  it("counts a VitePress warning container as compliant", () => {
    const result = analyzeRiskWarning({
      markdown: "::: warning ⚠️ 风险提示\n内容\n:::",
      kind: "lesson",
    });
    expect(result.status).toBe("pass");
    expect(result.containerBlocks).toBe(1);
  });

  it("treats a bare mention as review, not pass", () => {
    const result = analyzeRiskWarning({
      markdown: "每篇都配有风险提示框。",
      kind: "readme",
    });
    expect(result.status).toBe("review");
    expect(result.reasons).toContain("mention-only");
  });

  it("flags a fully missing block as a gap", () => {
    expect(
      analyzeRiskWarning({ markdown: "# 标题\n\n正文没有任何风险声明。", kind: "lesson" }).status
    ).toBe("gap");
  });

  it("defaults safely on empty input", () => {
    expect(analyzeRiskWarning()).toMatchObject({ kind: "lesson", status: "gap" });
  });
});
