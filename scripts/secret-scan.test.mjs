import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isLikelyPlaceholder, scanText } from "./secret-scan-lib.mjs";

const joined = (...parts) => parts.join("");

describe("secret scan rules", () => {
  it("识别私钥文件头", () => {
    const text = joined("-----BEGIN ", "OPENSSH PRIVATE KEY-----");
    expect(scanText(text).map((finding) => finding.rule)).toContain("private-key");
  });

  it("识别云平台与 SaaS token", () => {
    const text = [
      joined("AKIA", "IOSFODNN7EXAMPLE"),
      joined("ghp_", "A".repeat(36)),
      joined("sk-proj-", "b".repeat(24)),
      joined("AIza", "c".repeat(35)),
    ].join("\n");
    const rules = new Set(scanText(text).map((finding) => finding.rule));
    expect(rules).toEqual(
      new Set(["aws-access-key", "github-token", "openai-key", "google-api-key"]),
    );
  });

  it("识别 JWT", () => {
    const jwt = [
      joined("eyJ", "a".repeat(12)),
      joined("b", "B".repeat(12)),
      joined("c", "C".repeat(12)),
    ].join(".");
    expect(scanText(jwt).map((finding) => finding.rule)).toContain("jwt");
  });

  it("识别非占位符的硬编码密钥赋值", () => {
    const text = joined("AI_API_KEY=", '"', "z".repeat(24), '"');
    expect(scanText(text)).toMatchObject([
      { rule: "literal-secret-assignment", line: 1, column: 13 },
    ]);
  });

  it("保留准确的行列位置且不把值放进结果", () => {
    const secret = joined("ghp_", "D".repeat(36));
    const [finding] = scanText(`first line\nconst token = "${secret}";`);
    expect(finding).toMatchObject({ rule: "github-token", line: 2, column: 16 });
    expect(JSON.stringify(finding)).not.toContain(secret);
  });
});

describe("placeholder handling", () => {
  it("忽略环境变量引用、文档占位值和测试夹具", () => {
    expect(isLikelyPlaceholder("process.env.SUPABASE_SERVICE_ROLE_KEY")).toBe(true);
    expect(isLikelyPlaceholder("your_random_admin_token")).toBe(true);
    expect(isLikelyPlaceholder("service-role-test")).toBe(true);
  });

  it("不把真实形状的随机值当占位符", () => {
    expect(isLikelyPlaceholder("z".repeat(32))).toBe(false);
  });

  it("硬编码赋值门禁忽略占位值", () => {
    expect(scanText(joined("ADMIN_TOKEN=", "your_random_admin_token"))).toEqual([]);
  });
});

describe("secret scan CLI", () => {
  /** 在临时 git 仓里跑一次真实 CLI，返回 child_process 的结果（不抛错）。 */
  function runCli(dir, args) {
    const cli = fileURLToPath(new URL("./check-secrets.mjs", import.meta.url));
    try {
      const stdout = execFileSync(process.execPath, [cli, ...args], {
        cwd: dir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return { status: 0, stdout, stderr: "" };
    } catch (error) {
      return { status: error?.status, stdout: `${error?.stdout ?? ""}${error?.stderr ?? ""}` };
    }
  }

  it("对受控文件返回失败且不回显值", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trade-buty-secret-scan-"));
    const secret = "z".repeat(32);
    try {
      execFileSync("git", ["init", "-q"], { cwd: dir });
      fs.writeFileSync(path.join(dir, "leaked.env"), `API_KEY=${secret}\n`);

      // 夹具仓只有 1 个文件，过不了真实下限——这里带 --min-files 1，专测命中值那一路。
      const failure = runCli(dir, ["--min-files", "1"]);
      expect(failure.status).toBe(1);
      expect(failure.stdout).toContain("literal-secret-assignment");
      expect(failure.stdout).not.toContain(secret);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("清单短到不像话时判失败：「已扫描 0 个文件」不是通过（R16.83）", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trade-buty-secret-scan-floor-"));
    try {
      execFileSync("git", ["init", "-q"], { cwd: dir });
      fs.writeFileSync(path.join(dir, "clean.txt"), "nothing to see\n");

      const failure = runCli(dir, []);
      expect(failure.status).toBe(1);
      // 只匹配「下限 <数>」：这个数的主人在脚本里，抄在这里就是一份会过期的转述。
      expect(failure.stdout).toMatch(/只扫到 1 个，下限 \d+ 个（少 \d+）/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
