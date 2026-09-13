import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createKbLastModifiedReader,
  kbLastModified,
  parseKbCommitDate,
  readKbCommitDate,
  type KbFreshnessDeps,
} from "./kb-freshness";

const ISO = "2026-09-12T00:02:43+08:00";
const EXPECTED = "2026-09-11T16:02:43.000Z";
const KB_DIR = path.join("/repo", "content", "kline-buty");
const SITE_ROOT = path.join("/repo");

/**
 * 依据 git 参数返回 stdout 的假执行器。
 * 顺带断言被测代码传进来的目录就是目标目录，避免有人把 `-C dir` 拼错位置却仍然通过。
 */
function gitResponder(handler: (args: string[]) => string) {
  return (dir: string, args: string[]): string => {
    expect(dir).toBe(KB_DIR);
    return handler(args);
  };
}

/** 记录每次 git 调用的参数，便于断言「只问了一次」这类行为。 */
function recordingGit(handler: (args: string[]) => string) {
  const calls: string[][] = [];
  const execGit = (dir: string, args: string[]): string => {
    expect(dir).toBe(KB_DIR);
    calls.push(args);
    return handler(args);
  };
  return { execGit, calls };
}

/** 造一个「目录存在 + toplevel 等于目录 + 有提交时间」的正常 git 环境。 */
function okDeps(overrides: Partial<KbFreshnessDeps> = {}): KbFreshnessDeps {
  return {
    exists: () => true,
    execGit: gitResponder((args) => (args[0] === "rev-parse" ? `${KB_DIR}\n` : `${ISO}\n`)),
    ...overrides,
  };
}

describe("parseKbCommitDate", () => {
  it("解析 git 的 ISO 严格格式", () => {
    const d = parseKbCommitDate(ISO);
    expect(d?.toISOString()).toBe(EXPECTED);
  });

  it("允许前后空白", () => {
    expect(parseKbCommitDate(`  ${ISO}\n`)?.toISOString()).toBe(EXPECTED);
  });

  it("空值 / 非法值返回 null 而不是 Invalid Date", () => {
    expect(parseKbCommitDate("")).toBeNull();
    expect(parseKbCommitDate(undefined)).toBeNull();
    expect(parseKbCommitDate(null)).toBeNull();
    expect(parseKbCommitDate("not-a-date")).toBeNull();
  });
});

describe("readKbCommitDate", () => {
  it("正常子模块：取到 HEAD 提交时间", () => {
    expect(readKbCommitDate(KB_DIR, okDeps())?.toISOString()).toBe(EXPECTED);
  });

  it("目录不存在时直接返回 null，不调用 git", () => {
    const execGit = vi.fn();
    expect(readKbCommitDate(KB_DIR, { exists: () => false, execGit })).toBeNull();
    expect(execGit).not.toHaveBeenCalled();
  });

  it("toplevel 不是子模块目录时返回 null（防止把站点仓库时间当内容时间）", () => {
    const { execGit, calls } = recordingGit(() => `${SITE_ROOT}\n`);
    expect(readKbCommitDate(KB_DIR, { exists: () => true, execGit })).toBeNull();
    // 只问了 toplevel 就判定不可信，不该再花一次 git log
    expect(calls).toEqual([["rev-parse", "--show-toplevel"]]);
  });

  it("git 命令抛错（无 .git / 浅克隆 / 非仓库）时收敛成 null 而不是抛给构建", () => {
    expect(
      readKbCommitDate(KB_DIR, {
        exists: () => true,
        execGit: () => {
          throw new Error("fatal: not a git repository");
        },
      }),
    ).toBeNull();
  });

  it("git log 输出不可解析时返回 null", () => {
    const deps = okDeps({
      execGit: gitResponder((args) => (args[0] === "rev-parse" ? `${KB_DIR}\n` : "garbage\n")),
    });
    expect(readKbCommitDate(KB_DIR, deps)).toBeNull();
  });

  it("toplevel 用相对路径也能对上（path.resolve 归一化）", () => {
    const rel = path.relative(process.cwd(), KB_DIR) || ".";
    const deps = okDeps({
      execGit: gitResponder((args) => (args[0] === "rev-parse" ? `${rel}\n` : `${ISO}\n`)),
    });
    expect(readKbCommitDate(KB_DIR, deps)?.toISOString()).toBe(EXPECTED);
  });
});

describe("createKbLastModifiedReader", () => {
  it("结果在进程内缓存：重复调用只探测一次", () => {
    const { execGit, calls } = recordingGit((args) => (args[0] === "rev-parse" ? `${KB_DIR}\n` : `${ISO}\n`));
    const read = createKbLastModifiedReader(() => KB_DIR, { exists: () => true, execGit });
    expect(read()?.toISOString()).toBe(EXPECTED);
    expect(read()?.toISOString()).toBe(EXPECTED);
    // rev-parse + log 只跑一轮，第二次调用命中缓存
    expect(calls).toEqual([
      ["rev-parse", "--show-toplevel"],
      ["log", "-1", "--format=%cI"],
    ]);
  });

  it("读不到时把 null 也缓存住，不会每次调用都重试 git", () => {
    const execGit = vi.fn((dir: string, args: string[]) => {
      expect(dir).toBe(KB_DIR);
      expect(args[0]).toBe("rev-parse");
      throw new Error("boom");
    });
    const read = createKbLastModifiedReader(() => KB_DIR, { exists: () => true, execGit });
    expect(read()).toBeNull();
    expect(read()).toBeNull();
    expect(execGit).toHaveBeenCalledTimes(1);
  });
});

describe("kbLastModified（生产默认实例）", () => {
  it("对真实仓库不抛错，且同一进程内结果稳定", () => {
    const first = kbLastModified();
    expect(first === null || first instanceof Date).toBe(true);
    expect(kbLastModified()).toBe(first);
  });
});
