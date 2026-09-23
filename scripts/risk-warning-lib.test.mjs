import { describe, expect, it } from "vitest";
import {
  analyzeRiskWarning,
  auditFallbackRendering,
  auditFallbackWiring,
  FALLBACK_BLOCK,
  knowledgeRoute,
} from "./risk-warning-lib.mjs";

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

describe("auditFallbackRendering", () => {
  const gapRow = { locale: "zh", chapter: "technical-analysis", document: "README", kind: "readme", status: "gap" };
  const passRow = { locale: "en", chapter: "risk-management", document: "position-sizing", kind: "lesson", status: "pass" };
  const WITH_FALLBACK = `<body><div><h1>章</h1><aside role="note" aria-label="⚠️ 风险提示"><p>⚠️ 风险提示</p></aside></div></body>`;
  const COMPLIANT_BODY = `<body><div class="callout"><p>⚠️ 风险提示</p><p>正文自带合规块</p></div></body>`;
  const audit = (rows, artifacts) =>
    auditFallbackRendering({ rows, readArtifact: (_row, route) => artifacts[route] ?? null });

  it("maps readme rows to the chapter route and lesson rows to the doc route", () => {
    expect(knowledgeRoute(gapRow)).toBe("/zh/knowledge/technical-analysis");
    expect(knowledgeRoute(passRow)).toBe("/en/knowledge/risk-management/position-sizing");
  });

  it("stays quiet when every non-pass page actually renders the fallback", () => {
    const { issues, checked, fallbackPages } = audit(
      [gapRow, passRow],
      { "/zh/knowledge/technical-analysis": WITH_FALLBACK, "/en/knowledge/risk-management/position-sizing": COMPLIANT_BODY }
    );
    expect(issues).toEqual([]);
    expect({ checked, fallbackPages }).toEqual({ checked: 2, fallbackPages: 1 });
  });

  it("fails when an upstream gap page renders no fallback block", () => {
    expect(
      audit([gapRow], { "/zh/knowledge/technical-analysis": COMPLIANT_BODY }).issues
    ).toContain("/zh/knowledge/technical-analysis: 上游缺合规风险块（gap），站内兜底提示却没有渲染");
  });

  it("fails when a compliant page still gets a stacked fallback", () => {
    expect(
      audit([passRow], { "/en/knowledge/risk-management/position-sizing": WITH_FALLBACK }).issues
    ).toContain(
      "/en/knowledge/risk-management/position-sizing: 上游已有合规风险块，站内仍叠了一层兜底（重复展示）"
    );
  });

  it("does not mistake the article's own warning heading for the fallback block", () => {
    // 404 篇 pass 页面里 403 篇带「⚠️ 风险提示」字样（正文自己的块）。若标记取字样
    // 而不是取 `role="note"`，这条用例会因为它自己的判据而永远不报缺口。
    expect(FALLBACK_BLOCK.test(COMPLIANT_BODY)).toBe(false);
    expect(FALLBACK_BLOCK.test(WITH_FALLBACK)).toBe(true);
  });

  it("reports a missing artifact instead of passing silently", () => {
    const { issues, checked, fallbackPages } = audit([gapRow], {});
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("找不到构建产物");
    expect({ checked, fallbackPages }).toEqual({ checked: 0, fallbackPages: 0 });
  });
});
