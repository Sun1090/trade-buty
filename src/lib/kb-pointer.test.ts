import { describe, expect, it } from "vitest";
import {
  shortSha,
  isFullSha,
  checkRecordedVsWorking,
  checkSnapshotSync,
} from "../../scripts/kb-pointer-lib.mjs";

const SHA_A = "aa0297d63e25851658d8ead48b2536a6ceaf35fd";
const SHA_B = "5103c0db1cdf4a59c9d44d9d7a3f3b1a2e4f5a6b";

describe("kb-pointer lib (R10.18)", () => {
  it("shortSha 取 7 位短号，短输入原样返回", () => {
    expect(shortSha(SHA_A)).toBe("aa0297d");
    expect(shortSha(SHA_A, 10)).toBe("aa0297d63e");
    expect(shortSha("abc")).toBe("abc");
    expect(shortSha("")).toBe("");
    expect(shortSha(undefined)).toBe("");
  });

  it("isFullSha 只认 40 位十六进制", () => {
    expect(isFullSha(SHA_A)).toBe(true);
    expect(isFullSha("aa0297d")).toBe(false);
    expect(isFullSha("zz0297d63e25851658d8ead48b2536a6ceaf35fd")).toBe(false);
    expect(isFullSha("")).toBe(false);
  });

  it("recorded 与 working 一致 → null", () => {
    expect(checkRecordedVsWorking({ recorded: SHA_A, working: SHA_A })).toBeNull();
  });

  it("检出漂移（本地 update --remote 未提交指针）", () => {
    const r = checkRecordedVsWorking({ recorded: SHA_A, working: SHA_B });
    expect(r).not.toBeNull();
    expect(r!.kind).toBe("drift");
    expect(r!.message).toContain("aa0297d");
    expect(r!.message).toContain("5103c0d");
    expect(r!.message).toContain("kb:update");
  });

  it("任一侧缺失 → unresolved", () => {
    const a = checkRecordedVsWorking({ recorded: "", working: SHA_A });
    expect(a).not.toBeNull();
    expect(a!.kind).toBe("unresolved");
    const b = checkRecordedVsWorking({ recorded: SHA_A, working: "" });
    expect(b).not.toBeNull();
    expect(b!.kind).toBe("unresolved");
  });

  it("recorded 与快照指针一致 → null", () => {
    expect(checkSnapshotSync({ recorded: SHA_A, snapshotPointer: SHA_A })).toBeNull();
  });

  it("快照缺 pointer（旧版快照）→ snapshot-stale", () => {
    const r = checkSnapshotSync({ recorded: SHA_A, snapshotPointer: "" });
    expect(r).not.toBeNull();
    expect(r!.kind).toBe("snapshot-stale");
    expect(r!.message).toContain("kb:diff");
  });

  it("指针已提交但快照未刷新 → snapshot-stale", () => {
    const r = checkSnapshotSync({ recorded: SHA_A, snapshotPointer: SHA_B });
    expect(r).not.toBeNull();
    expect(r!.kind).toBe("snapshot-stale");
    expect(r!.message).toContain("aa0297d");
    expect(r!.message).toContain("5103c0d");
    expect(r!.message).toContain("kb-manifest.json");
  });

  it("仓库未记录指针 → unresolved", () => {
    const r = checkSnapshotSync({ recorded: "", snapshotPointer: SHA_A });
    expect(r).not.toBeNull();
    expect(r!.kind).toBe("unresolved");
  });
});
