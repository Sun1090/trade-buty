import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { auditGrowthEventPrivacy, run, stripComments } from "./growth-event-privacy.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const AUDIT_SCRIPT = path.join(HERE, "growth-event-privacy.mjs");
const fixture = () => ({
  source: fs.readFileSync(path.join(ROOT, "src/lib/growth-events.ts"), "utf8"),
  docs: fs.readFileSync(path.join(ROOT, "docs/growth-events.md"), "utf8"),
  privacyPage: fs.readFileSync(path.join(ROOT, "src/app/[locale]/privacy/page.tsx"), "utf8"),
});

describe("growth event privacy audit", () => {
  it("accepts the tracked console-only implementation and catalog", () => {
    const { errors, eventNames } = auditGrowthEventPrivacy(fixture());
    expect(errors).toEqual([]);
    expect(eventNames).toHaveLength(8);
  });

  it("does not treat forbidden APIs in comments as executable sinks", () => {
    expect(stripComments("/* localStorage fetch() */\n// document.cookie\nconst ok = true;")).toBe(
      "\nconst ok = true;",
    );
  });

  it("rejects network, storage, cookie and clipboard sinks", () => {
    const input = fixture();
    input.source += "\nfetch('/collect'); localStorage.setItem('x', '1'); document.cookie = 'x=1'; navigator.clipboard.readText();";
    const { errors } = auditGrowthEventPrivacy(input);
    expect(errors.some((error) => error.includes("network fetch"))).toBe(true);
    expect(errors.some((error) => error.includes("persistent storage"))).toBe(true);
    expect(errors.some((error) => error.includes("cookie"))).toBe(true);
    expect(errors.some((error) => error.includes("clipboard"))).toBe(true);
  });

  it("requires normalized logger output and every event in the catalog", () => {
    const input = fixture();
    input.source = input.source.replace(
      'console.info("[growth-event]", safe.name, safe);',
      'console.info("[growth-event]", event);',
    );
    input.docs = input.docs.replaceAll("share_card_download", "removed_event");
    const { errors } = auditGrowthEventPrivacy(input);
    expect(errors).toContain("console.info must receive only the normalized safe event");
    expect(errors.some((error) => error.includes("event catalog is missing share_card_download"))).toBe(true);
  });

  it("requires exactly one logger sink and a readable event catalog", () => {
    const input = fixture();
    input.source = input.source.replace('console.info("[growth-event]", safe.name, safe);', "");
    input.docs = input.docs.replace("明确禁止", "");
    const { errors } = auditGrowthEventPrivacy(input);
    expect(errors).toContain("expected exactly one console.info sink, found 0");
    expect(errors).toContain("event catalog must document prohibited fields");
  });

  it("rejects a source without the normalization boundary", () => {
    const input = fixture();
    input.source = input.source.replaceAll("normalizeGrowthEvent", "normalizeRemoved");
    const { errors } = auditGrowthEventPrivacy(input);
    expect(errors).toContain("growth event sink must pass through normalizeGrowthEvent");
  });

  it("requires a bilingual privacy-policy disclosure for the local console", () => {
    const input = fixture();
    input.privacyPage = input.privacyPage.replace(/console/gi, "removed").replace(/控制台/g, "removed");
    const { errors } = auditGrowthEventPrivacy(input);
    expect(errors).toContain(
      "privacy policy must disclose the local console-only debug channel in both locales",
    );
  });
  it("detects every prohibited browser sink", () => {
    const input = fixture();
    input.source += `
      XMLHttpRequest;
      sessionStorage.getItem("x");
      indexedDB.open("x");
      navigator.sendBeacon("/x");
    `;
    const { errors } = auditGrowthEventPrivacy(input);
    expect(errors).toEqual(expect.arrayContaining([
      "growth event source contains forbidden network sendBeacon",
      "growth event source contains forbidden network XMLHttpRequest",
      "growth event source contains forbidden persistent storage",
    ]));
  });

  it("reports malformed event catalogs and duplicate logger sinks", () => {
    const input = fixture();
    input.source = input.source
      .replace('console.info("[growth-event]", safe.name, safe);', 'console.info("[growth-event]", safe.name, safe);\n  console.info("duplicate");')
      .replace(/GROWTH_EVENT_NAMES\s*=\s*\[[\s\S]*?\]\s*as const/, "const GROWTH_EVENT_NAMES = [] as const");
    const { errors } = auditGrowthEventPrivacy(input);
    expect(errors).toContain("expected exactly one console.info sink, found 2");
    expect(errors).toContain("could not read GROWTH_EVENT_NAMES");
  });

  it("exits successfully when the privacy audit passes", () => {
    const output = execFileSync(process.execPath, [AUDIT_SCRIPT], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    expect(output).toContain("growth event privacy audit passed: 8 events");
  });

  it("exits non-zero and reports all audit failures", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "growth-event-privacy-cli-"));
    const harness = path.join(tempDir, "failure-harness.mjs");
    const failedSource = [
      "export const GROWTH_EVENT_NAMES = [\"share_card_download\"] as const;",
      "fetch(\"/collect\");",
      "console.info(\"[growth-event]\", safe.name, safe);",
      "normalizeGrowthEvent();",
    ].join("\n");
    const harnessSource = [
      `import { auditGrowthEventPrivacy } from ${JSON.stringify(AUDIT_SCRIPT)};`,
      `const source = ${JSON.stringify(failedSource)};`,
      `const result = auditGrowthEventPrivacy({ source, docs: "event names only", privacyPage: "no local browser debug disclosure" });`,
      `if (result.errors.length > 0) {`,
      `  console.error("growth event privacy audit failed:");`,
      `  for (const error of result.errors) console.error("- " + error);`,
      `  process.exit(1);`,
      `}`,
      `console.log("growth event privacy audit passed: " + result.eventNames.length);`,
    ].join("\n");

    fs.writeFileSync(harness, harnessSource);

    try {
      execFileSync(process.execPath, [harness], {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      expect.unreachable("failure harness should exit non-zero");
    } catch (error) {
      expect(error.status).toBe(1);
      const output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
      expect(output).toContain("growth event privacy audit failed");
      expect(output).toContain("growth event source contains forbidden network fetch");
      expect(output).toContain("event catalog is missing share_card_download");
      expect(output).toContain("event catalog must document prohibited fields");
      expect(output).toContain("privacy policy must disclose the local console-only debug channel in both locales");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

it("runs the real CLI entrypoint from an injected root", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "growth-event-privacy-run-"));
  const sourcePath = path.join(tempDir, "src/lib/growth-events.ts");
  const docsPath = path.join(tempDir, "docs/growth-events.md");
  const privacyPath = path.join(tempDir, "src/app/[locale]/privacy/page.tsx");
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.mkdirSync(path.dirname(docsPath), { recursive: true });
  fs.mkdirSync(path.dirname(privacyPath), { recursive: true });
  fs.writeFileSync(sourcePath, [
    'export const GROWTH_EVENT_NAMES = ["install_prompt"] as const;',
    'export function track(safe){ console.info("[growth-event]", safe.name, safe); normalizeGrowthEvent(safe); }',
  ].join("\n"));
  fs.writeFileSync(docsPath, "install_prompt 明确禁止 email userId\n");
  fs.writeFileSync(privacyPath, "console 控制台\n");
  let code = null;
  const errors = [];
  const logs = [];
  try {
    run({
      rootDir: tempDir,
      log: (message) => logs.push(String(message)),
      error: (message) => errors.push(String(message)),
      exit: (value) => { code = value; },
    });
    expect(logs[0]).toContain("growth event privacy audit passed: 1 events");
    expect(errors).toEqual([]);
    expect(code).toBeNull();
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

it("runs the real CLI entrypoint failure branch without calling process.exit", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "growth-event-privacy-run-fail-"));
  const sourcePath = path.join(tempDir, "src/lib/growth-events.ts");
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "src/app/[locale]/privacy"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "docs"), { recursive: true });
  fs.writeFileSync(sourcePath, [
    'export const GROWTH_EVENT_NAMES = ["install_prompt"] as const;',
    'export function track(safe){ fetch("/collect"); console.info("[growth-event]", safe.name, safe); normalizeGrowthEvent(safe); }',
  ].join("\n"));
  fs.writeFileSync(path.join(tempDir, "docs/growth-events.md"), "no event name\n");
  fs.writeFileSync(path.join(tempDir, "src/app/[locale]/privacy/page.tsx"), "no disclosure\n");
  let code = null;
  const errors = [];
  const logs = [];
  try {
    run({
      rootDir: tempDir,
      log: (message) => logs.push(String(message)),
      error: (message) => errors.push(String(message)),
      exit: (value) => { code = value; },
    });
    expect(logs).toEqual([]);
    expect(code).toBe(1);
    expect(errors[0]).toBe("growth event privacy audit failed:");
    expect(errors.join("\n")).toContain("growth event source contains forbidden network fetch");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
