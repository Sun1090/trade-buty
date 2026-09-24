import { describe, expect, it } from "vitest";
import { scanFloorViolation } from "./scan-floor-lib.mjs";

describe("scanFloorViolation（R16.83）", () => {
  it("扫到下限及以上就闭嘴：多扫永远不需要改门禁", () => {
    expect(scanFloorViolation({ count: 419, floor: 400, what: "知识库 md 文件" })).toBeNull();
    expect(scanFloorViolation({ count: 400, floor: 400, what: "知识库 md 文件" })).toBeNull();
  });

  it("少扫一个就报，并且把两个数都念出来", () => {
    const msg = scanFloorViolation({ count: 399, floor: 400, what: "route.ts" });
    expect(msg).toContain("399");
    expect(msg).toContain("400");
    expect(msg).toContain("route.ts");
  });

  it("目录缺失导致扫到 0 时一定响：这正是这条门禁存在的理由", () => {
    expect(scanFloorViolation({ count: 0, floor: 400, what: "知识库 md 文件" })).toContain("只扫到 0");
  });

  it("下限写成 0 就直接抛：永远不会响的检查比没有检查更危险", () => {
    expect(() => scanFloorViolation({ count: 0, floor: 0, what: "x" })).toThrow(/永远不会响/);
    expect(() => scanFloorViolation({ count: 0, floor: -1, what: "x" })).toThrow(/永远不会响/);
    expect(() => scanFloorViolation({ count: 0, floor: "400", what: "x" })).toThrow(/正整数/);
    expect(() => scanFloorViolation({ count: 0, floor: 4.5, what: "x" })).toThrow(/正整数/);
  });

  it("数量不是整数同样抛，不当 0 放过去", () => {
    expect(() => scanFloorViolation({ count: undefined, floor: 10, what: "x" })).toThrow(/不是非负整数/);
    expect(() => scanFloorViolation({ count: NaN, floor: 10, what: "x" })).toThrow(/不是非负整数/);
    expect(() => scanFloorViolation({ count: -1, floor: 10, what: "x" })).toThrow(/不是非负整数/);
    expect(() => scanFloorViolation({ count: 1.5, floor: 10, what: "x" })).toThrow(/不是非负整数/);
  });
});
