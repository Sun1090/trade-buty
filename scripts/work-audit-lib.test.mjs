import { describe, expect, it } from "vitest";
import {
  countUnlandedPatches,
  findUnconfirmedClosedPullRequests,
  isCommitLanded,
  isValidAcknowledgement,
  parseRefs,
  parseUnpushedCommits,
  renderWorkAuditReport,
  workAuditExit,
} from "./work-audit-lib.mjs";

describe("parseUnpushedCommits", () => {
  it("parses sha, branch decoration and subject", () => {
    const [commit] = parseUnpushedCommits(
      "abc123def456\tHEAD -> feat/x\tfix(thing): subject with\ttab"
    );
    expect(commit).toEqual({
      sha: "abc123def456",
      refs: "feat/x",
      subject: "fix(thing): subject with\ttab",
    });
  });

  it("tolerates empty and whitespace-only input", () => {
    expect(parseUnpushedCommits("")).toEqual([]);
    expect(parseUnpushedCommits("\n  \n")).toEqual([]);
    expect(parseUnpushedCommits(null)).toEqual([]);
  });

  it("keeps commits without ref decoration", () => {
    expect(parseUnpushedCommits("deadbeef\t\tchore: x")[0].refs).toBe("");
  });
});

describe("parseRefs", () => {
  it("keeps local branch names and drops HEAD, remote tracking refs and tags", () => {
    expect(parseRefs("HEAD -> feat/x, origin/feat/x, tag: v1")).toBe("feat/x");
    expect(parseRefs("feat/a, feat/b")).toBe("feat/a, feat/b");
    expect(parseRefs("HEAD")).toBe("");
    expect(parseRefs(undefined)).toBe("");
  });
});

describe("patch landing checks", () => {
  it("counts patches missing from upstream", () => {
    expect(countUnlandedPatches("+ aaa\n- bbb\n+ ccc\n")).toBe(2);
    expect(countUnlandedPatches("- aaa\n")).toBe(0);
    expect(countUnlandedPatches("")).toBe(0);
  });

  it("reads the per-commit patch verdict by sha", () => {
    expect(isCommitLanded("- abc123 abc\n", "abc123")).toBe(true);
    expect(isCommitLanded("+ abc123 abc\n", "abc123")).toBe(false);
    expect(isCommitLanded("- other456 other\n", "abc123")).toBe(false);
    expect(isCommitLanded("", "abc123")).toBe(false);
  });
});

describe("findUnconfirmedClosedPullRequests", () => {
  const prs = [
    { number: 1, state: "CLOSED", mergedAt: null, headRefOid: "a", headRefName: "b" },
    { number: 2, state: "CLOSED", mergedAt: "2026-09-20T00:00:00Z", headRefOid: "c" },
    { number: 3, state: "OPEN", mergedAt: null, headRefOid: "d" },
    { number: 4, state: "CLOSED", mergedAt: null, headRefOid: "e", unlandedPatches: 2 },
  ];

  it("keeps only closed, unmerged pull requests", () => {
    expect(findUnconfirmedClosedPullRequests(prs).map((pr) => pr.number)).toEqual([1, 4]);
  });

  it("skips acknowledged numbers and carries the patch count through", () => {
    const result = findUnconfirmedClosedPullRequests(prs, [{ number: 1, reason: "已回收" }]);
    expect(result).toEqual([
      { number: 4, title: undefined, branch: undefined, sha: "e", unlandedPatches: 2 },
    ]);
  });

  it("handles missing input", () => {
    expect(findUnconfirmedClosedPullRequests(undefined)).toEqual([]);
    expect(findUnconfirmedClosedPullRequests([], undefined)).toEqual([]);
  });

  it("matches REST's lowercase state (regression: a false-clean audit)", () => {
    const restShape = [
      { number: 11, state: "closed", mergedAt: null, headRefOid: "f", headRefName: "codex/x", title: "Lost work" },
      { number: 12, state: "closed", mergedAt: "2026-09-20T00:00:00Z", headRefOid: "g" },
    ];
    expect(findUnconfirmedClosedPullRequests(restShape).map((pr) => pr.number)).toEqual([11]);
  });
});

describe("isValidAcknowledgement", () => {
  it("requires both a PR number and a reason", () => {
    expect(isValidAcknowledgement({ number: 99, reason: "已随 PR #105 回收" })).toBe(true);
    expect(isValidAcknowledgement({ number: 99 })).toBe(false);
    expect(isValidAcknowledgement({ number: 99, reason: "   " })).toBe(false);
    expect(isValidAcknowledgement({ reason: "x" })).toBe(false);
    expect(isValidAcknowledgement(null)).toBe(false);
  });
});

describe("renderWorkAuditReport", () => {
  it("says so when nothing is wrong", () => {
    expect(renderWorkAuditReport({})).toContain("没有发现悬空工作");
    expect(renderWorkAuditReport({ ghSkipped: true })).toContain("仅审计本地提交");
  });

  it("separates truly stranded work from stale local branches", () => {
    const text = renderWorkAuditReport({
      unpushed: [{ sha: "aaa1111bbb", refs: "feat/live", subject: "fix(x): real work" }],
      stale: [{ sha: "ccc2222ddd", refs: "feat/old", subject: "test(y): landed" }],
      unconfirmed: [{ number: 7, title: "Dropped", branch: "codex/z", sha: "eee3333fff", unlandedPatches: 1 }],
    });
    expect(text).toContain("❌ 本地存在 1 个内容从未进入 main 的提交");
    expect(text).toContain("feat/live");
    expect(text).toContain("ℹ️ 1 个本地提交的内容已在 main 上");
    expect(text).toContain("#7 Dropped");
    expect(text).toContain("main 上找不到对应补丁的提交 1 个");
  });
});

describe("workAuditExit", () => {
  it("本地跑：发现悬空提交或未确认的关闭 PR 才失败", () => {
    expect(workAuditExit({})).toBe(0);
    expect(workAuditExit({ stranded: [{ sha: "aaaaaaa" }] })).toBe(1);
    expect(workAuditExit({ unconfirmed: [{ number: 7 }] })).toBe(1);
    expect(workAuditExit({ stale: [{ sha: "bbbbbbb" }] })).toBe(0);
  });

  it("CI 模式：读不到 GitHub 必须失败，而不是让门禁静默变绿", () => {
    expect(workAuditExit({ ghSkipped: true })).toBe(0);
    expect(workAuditExit({ ghSkipped: true, requireGh: true })).toBe(1);
    expect(workAuditExit({ ghSkipped: false, requireGh: true })).toBe(0);
  });

  it("接受计数或数组两种入参形状", () => {
    expect(workAuditExit({ stranded: 2 })).toBe(1);
    expect(workAuditExit({ unconfirmed: 0 })).toBe(0);
    expect(workAuditExit({ stranded: [], unconfirmed: [], ghSkipped: false })).toBe(0);
  });
});
