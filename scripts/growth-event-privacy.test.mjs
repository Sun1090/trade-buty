import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { auditGrowthEventPrivacy, stripComments } from "./growth-event-privacy.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const fixture = () => ({
  source: fs.readFileSync(path.join(ROOT, "src/lib/growth-events.ts"), "utf8"),
  docs: fs.readFileSync(path.join(ROOT, "docs/growth-events.md"), "utf8"),
  privacyPage: fs.readFileSync(path.join(ROOT, "src/app/[locale]/privacy/page.tsx"), "utf8"),
});

describe("growth event privacy audit", () => {
  it("accepts the tracked console-only implementation and catalog", () => {
    const { errors, eventNames } = auditGrowthEventPrivacy(fixture());
    expect(errors).toEqual([]);
    expect(eventNames).toHaveLength(7);
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

  it("requires a bilingual privacy-policy disclosure for the local console", () => {
    const input = fixture();
    input.privacyPage = input.privacyPage.replace(/console/gi, "removed").replace(/控制台/g, "removed");
    const { errors } = auditGrowthEventPrivacy(input);
    expect(errors).toContain(
      "privacy policy must disclose the local console-only debug channel in both locales",
    );
  });
});
