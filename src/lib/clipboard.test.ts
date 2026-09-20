// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { copyText, copyViaExecCommand } from "./clipboard";

function stubClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", {
    value,
    configurable: true,
    writable: true,
  });
}

describe("copyText", () => {
  beforeEach(() => {
    document.execCommand = vi.fn(() => false) as unknown as typeof document.execCommand;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("异步剪贴板可用时不走 execCommand 兜底", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });
    await expect(copyText("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
    expect(document.execCommand).not.toHaveBeenCalled();
  });

  it("异步剪贴板被拒绝时退回 execCommand 并返回真实结果", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    stubClipboard({ writeText });
    document.execCommand = vi.fn(() => true) as unknown as typeof document.execCommand;
    await expect(copyText("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });

  it("异步 API 缺失（微信内置浏览器等）时直接用兜底", async () => {
    stubClipboard(undefined);
    document.execCommand = vi.fn(() => true) as unknown as typeof document.execCommand;
    await expect(copyText("hello")).resolves.toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });

  it("execCommand 返回 false 时如实返回失败，不伪装成功", async () => {
    stubClipboard(undefined);
    document.execCommand = vi.fn(() => false) as unknown as typeof document.execCommand;
    await expect(copyText("hello")).resolves.toBe(false);
  });

  it("execCommand 抛错时收敛成失败，不产生未处理拒绝", async () => {
    stubClipboard(undefined);
    document.execCommand = vi.fn(() => {
      throw new Error("not allowed");
    }) as unknown as typeof document.execCommand;
    await expect(copyText("hello")).resolves.toBe(false);
  });
});

describe("copyViaExecCommand", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("写入后清理临时 textarea，不在 DOM 留下痕迹", () => {
    document.execCommand = vi.fn(() => true) as unknown as typeof document.execCommand;
    const before = document.body.children.length;
    expect(copyViaExecCommand("payload")).toBe(true);
    expect(document.body.children.length).toBe(before);
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("execCommand 缺失时返回 false 且清理临时节点", () => {
    // 某些沙箱/非浏览器环境没有 execCommand
    delete (document as unknown as { execCommand?: unknown }).execCommand;
    const before = document.body.children.length;
    expect(copyViaExecCommand("payload")).toBe(false);
    expect(document.body.children.length).toBe(before);
  });

  it("节点创建失败时直接失败", () => {
    const spy = vi.spyOn(document, "createElement").mockImplementation(() => {
      throw new Error("not allowed");
    });
    expect(copyViaExecCommand("payload")).toBe(false);
    spy.mockRestore();
  });

  it("节点写入或选择失败时清理临时 textarea", () => {
    const valueSetter = vi.fn(() => {
      throw new Error("readonly textarea");
    });
    const originalCreate = document.createElement.bind(document);
    const area = originalCreate("textarea");
    Object.defineProperty(area, "value", { set: valueSetter, configurable: true });
    const spy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "textarea") return area;
      return originalCreate(tag);
    });
    const before = document.body.children.length;
    expect(copyViaExecCommand("payload")).toBe(false);
    expect(document.body.children.length).toBe(before);
    spy.mockRestore();
  });
});
