import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { auditErrorReportPrivacy, stripComments } from "./error-report-privacy.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const fixture = () => ({
  clientSource: fs.readFileSync(path.join(ROOT, "src/lib/error-report.ts"), "utf8"),
  routeSource: fs.readFileSync(path.join(ROOT, "src/app/api/error-reports/route.ts"), "utf8"),
  docs: fs.readFileSync(path.join(ROOT, "docs/error-reporting.md"), "utf8"),
  privacyPage: fs.readFileSync(path.join(ROOT, "src/app/[locale]/privacy/page.tsx"), "utf8"),
});

describe("error report privacy audit", () => {
  it("accepts the tracked privacy-safe implementation", () => {
    const { errors, endpoint } = auditErrorReportPrivacy(fixture());
    expect(errors).toEqual([]);
    expect(endpoint).toBe("/api/error-reports");
  });

  it("does not treat forbidden identifiers in comments as real leaks", () => {
    expect(stripComments("/* err.message href */\n// location.href\nconst ok = true;")).toBe(
      "\nconst ok = true;",
    );
  });

  it("rejects a payload builder that leaks error message or page URL", () => {
    const input = fixture();
    input.clientSource = input.clientSource
      .replace("if (level === \"silent\") return null;", "if (level === \"silent\") return null;\n  const leak = err.message;")
      .replace("const rawKind =", "const where = location.href;\n  const rawKind =");
    const { errors } = auditErrorReportPrivacy(input);
    expect(errors).toContain("error-report payload builder references error message");
    expect(errors).toContain("error-report payload builder references page URL");
  });

  it("rejects non-allowlisted payload fields", () => {
    const input = fixture();
    input.clientSource = input.clientSource.replace(
      "  digest?: string;\n}",
      "  digest?: string;\n  email?: string;\n}",
    );
    const { errors } = auditErrorReportPrivacy(input);
    expect(errors).toContain("payload declares non-allowlisted fields: email");
  });

  it("rejects a route that reads the body unbounded or drops the allowlist", () => {
    const input = fixture();
    input.routeSource = input.routeSource
      .replace("const raw = await readBoundedBody(req, MAX_ERROR_REPORT_BYTES);", "const raw = await req.json();")
      .replaceAll("ERROR_REPORT_ALLOWED_KEYS", "[\"level\", \"scope\", \"kind\", \"digest\"]");
    const { errors } = auditErrorReportPrivacy(input);
    expect(errors).toContain("route must not call req.json() (unbounded body); use the bounded reader");
    expect(errors).toContain("route must reject unknown payload keys via ERROR_REPORT_ALLOWED_KEYS");
  });

  it("requires a bilingual privacy disclosure for the endpoint", () => {
    const input = fixture();
    input.privacyPage = input.privacyPage
      .replaceAll("/api/error-reports", "removed-endpoint")
      .replace(/不写入数据库/g, "removed")
      .replace(/not stored in our database/g, "removed");
    const { errors } = auditErrorReportPrivacy(input);
    expect(errors).toContain("privacy policy must name the /api/error-reports endpoint");
    expect(errors).toContain("privacy policy must disclose that diagnostics are not persisted");
  });

  it("requires the endpoint docs to list every allowlisted field", () => {
    const input = fixture();
    input.docs = input.docs.replaceAll("digest", "removed");
    const { errors } = auditErrorReportPrivacy(input);
    expect(errors).toContain("docs/error-reporting.md is missing field digest");
  });
});
