/**
 * R16.317：门禁本体的用例。
 *
 * 判据（`comment-path-lib.mjs`）另有 20 条自己的用例，这里只钉 CLI 这一段：
 * 三条分支（文件数地板 / 引用数地板 / 失效引用）各自必须真的能 exit 1。
 * 探针 D3 削掉 `if (shrunk)` 之后原先无人喊红——地板分支写在 CLI 里，
 * 没有用例就等于没有：一次「少扫」会被打印成通过（R16.83 那一族）。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COMMENT_PATH_EXCUSED } from "./comment-path-lib.mjs";
import { MIN_SOURCE_FILES, run } from "./check-comment-paths.mjs";

/**
 * 夹具底座：按豁免表逐条造一行「那句话还在」的合成源码。
 *
 * 「豁免没被用到就转红」是判据之一，所以只喂局部文件的夹具会先撞它。
 * 底座由表推导：表里加一条豁免，这里不用跟着改。
 */
const EXCUSED_FIXTURE = Object.fromEntries(
  COMMENT_PATH_EXCUSED.map((entry) => [
    entry.file,
    " * 反例引用：`" + entry.ref + "`\n",
  ]),
);

/** 建一个临时 git 仓，写入若干文件并提交，返回仓库根。 */
function fixtureRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "comment-paths-"));
  const git = (args) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  git(["init", "-q"]);
  git(["config", "user.email", "t@example.invalid"]);
  git(["config", "user.name", "t"]);
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  git(["add", "-A"]);
  git(["commit", "-qm", "fixture"]);
  return dir;
}

function runFixture(files, options = {}) {
  const dir = fixtureRepo({ ...EXCUSED_FIXTURE, ...files });
  const code = { value: 0 };
  const err = [];
  try {
    run({
      rootDir: dir,
      minSourceFiles: 1,
      minRefsFloor: 1,
      exit: (n) => {
        code.value = n;
      },
      log: () => {},
      error: (line) => err.push(String(line)),
      ...options,
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return { code: code.value, err: err.join("\n") };
}

describe("check:comment-paths CLI", () => {
  it("夹具里没有失效引用时判绿", () => {
    const { code, err } = runFixture({
      "src/lib/real.ts": "// 见 src/lib/other.ts\nexport const a = 1;\n",
      "src/lib/other.ts": "export const b = 2;\n",
    });
    expect(code, err).toBe(0);
  });

  it("注释点名一个不存在的文件 → exit 1 并点名文件与行号", () => {
    const { code, err } = runFixture({
      "src/lib/real.ts": "// 这条正则与 rewriteLinks（src/lib/ghost.ts）是一对契约\nexport const a = 1;\n",
      "src/lib/other.ts": "export const b = 2;\n",
    });
    expect(code).toBe(1);
    expect(err).toContain("src/lib/real.ts:1");
    expect(err).toContain("src/lib/ghost.ts");
  });

  it("源码文件数跌破地板 → exit 1，且红字把两个数都念出来", () => {
    const { code, err } = runFixture(
      { "src/lib/one.ts": "// 没有引用\n" },
      { minSourceFiles: 5 },
    );
    expect(code).toBe(1);
    // 底座那份豁免文件也在扫描面里，所以这里核「地板比实测大」这件事而不是核一个具体数
    expect(err).toMatch(/只扫到 (\d+) 个/);
    expect(err).toMatch(/下限 5 个/);
    expect(Number(/只扫到 (\d+) 个/.exec(err)[1])).toBeLessThan(5);
  });

  it("引用数地板也真的会退出：正则被改坏时少认不等于全绿", () => {
    let exitCalled = null;
    const dir = fixtureRepo({ ...EXCUSED_FIXTURE, "src/lib/one.ts": "// 见 src/lib/one.ts\n" });
    try {
      run({
        rootDir: dir,
        minSourceFiles: 1,
        minRefsFloor: 999,
        exit: (code) => {
          exitCalled = code;
        },
        log: () => {},
        error: () => {},
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    expect(exitCalled, "引用数越界却没有 exit").toBe(1);
  });

  it("真实仓库跑一遍是绿的（判据没有把现状判红）", () => {
    const code = { value: 0 };
    // 不带任何地板参数：这条跑的就是 CI 用的真实下限
    run({
      exit: (n) => {
        code.value = n;
      },
      log: () => {},
      error: (line) => process.stderr.write(`${line}\n`),
    });
    expect(code.value).toBe(0);
  });

  it("文件数地板贴着实测量：写成 0 或非整数会被 scanFloorViolation 抛", () => {
    expect(Number.isInteger(MIN_SOURCE_FILES)).toBe(true);
    expect(MIN_SOURCE_FILES).toBeGreaterThan(0);
    expect(() =>
      run({ rootDir: process.cwd(), minSourceFiles: 0, exit: () => {}, log: () => {}, error: () => {} }),
    ).toThrow(/下限必须是正整数/);
  });
});
