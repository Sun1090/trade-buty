// @vitest-environment node
import { describe, expect, it } from "vitest";
import { copyText } from "./clipboard";

describe("copyText SSR guard", () => {
  it("浏览器上下文缺失时如实返回 false，不抛错", async () => {
    await expect(copyText("hello")).resolves.toBe(false);
  });
});
