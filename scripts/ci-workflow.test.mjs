import fs from "node:fs";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const workflowPath = ".github/workflows/ci.yml";

function loadWorkflow() {
  return yaml.loadAll(fs.readFileSync(workflowPath, "utf8"));
}

describe("CI workflow contract", () => {
  it("keeps the workflow in one YAML document", () => {
    expect(loadWorkflow()).toHaveLength(1);
  });

  it("keeps all post-dry-run quality gates in the workflow", () => {
    const [workflow] = loadWorkflow();
    const steps = workflow.jobs.ci.steps;
    const commands = steps
      .map((step) => step.run)
      .filter(Boolean)
      .join("\n");
    const names = steps.map((step) => step.name).filter(Boolean);

    for (const command of [
      "npm run audit:prod",
      "npm run audit:all",
      "npm run check:secrets",
      "npm run check:mobile",
      "npm run check:quiz-mounts",
      "npm run check:quiz-coverage",
      "npm run check:links",
      "npm run check:sitemap",
      "npm run check:bundle",
      "npm run e2e",
      "npm run lhci",
      "npm run kb:inventory",
      "npm run kb:gap-priority",
      "npm run kb:accept",
      "npm run kb:translation-status",
      "npm run check:title-terminology",
      "npm run check:description-quality",
      "npm run check:risk-warning",
    ]) {
      expect(commands).toContain(command);
    }
    expect(names).toContain("生成内容质量报告（R10.1–R10.6 / R10.17）");
    expect(names).toContain("内容质量报告归档（R10.17）");
  });
});
