import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

const script = path.resolve("scripts/check-kb-changelog.mjs");
const tempDirs = [];

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "trade-buty-kb-changelog-"));
  tempDirs.push(root);
  const kb = path.join(root, "knowledge");
  const zh = path.join(kb, "zh", "spot");
  fs.mkdirSync(zh, { recursive: true });
  fs.writeFileSync(path.join(zh, "basics.md"), "# Basics\n");
  return {
    root,
    kb,
    manifest: path.join(root, "kb-manifest.json"),
    out: path.join(root, "kb-changelog.md"),
  };
}

function hashFile(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function runCheck({ kb, manifest, out }) {
  return spawnSync(
    process.execPath,
    [script, "--check", "--kb", kb, "--manifest", manifest, "--out", out],
    { cwd: process.cwd(), encoding: "utf8" }
  );
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("check-kb-changelog --check", () => {
  it("passes without writing a changelog when hashes match", () => {
    const fixture = makeFixture();
    fs.writeFileSync(
      fixture.manifest,
      JSON.stringify({
        files: ["zh/spot/basics.md"],
        hashes: { "zh/spot/basics.md": hashFile(path.join(fixture.kb, "zh/spot/basics.md")) },
      })
    );

    const result = runCheck(fixture);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("知识库 hash 基线一致");
    expect(fs.existsSync(fixture.out)).toBe(false);
  });

  it("fails on content drift and prints the changed paths", () => {
    const fixture = makeFixture();
    const file = path.join(fixture.kb, "zh/spot/basics.md");
    fs.writeFileSync(
      fixture.manifest,
      JSON.stringify({
        files: ["zh/spot/basics.md"],
        hashes: { "zh/spot/basics.md": hashFile(file) },
      })
    );
    fs.writeFileSync(file, "# Basics changed\n");

    const result = runCheck(fixture);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("hash 基线不一致");
    expect(result.stderr).toContain("内容更新 1");
    expect(result.stderr).toContain("zh/spot/basics.md");
    expect(fs.existsSync(fixture.out)).toBe(false);
  });

  it("fails closed when the hash baseline is missing", () => {
    const fixture = makeFixture();
    fs.writeFileSync(fixture.manifest, JSON.stringify({ files: ["zh/spot/basics.md"] }));

    const result = runCheck(fixture);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("尚无内容 hash 基线");
  });
});
