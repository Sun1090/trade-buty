// @vitest-environment jsdom
import path from "node:path";
import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dynamicMock = vi.hoisted(() => vi.fn(() => () => null));

vi.mock("next/dynamic", () => ({ default: dynamicMock }));

type DynamicCall = [() => Promise<unknown>, { ssr?: boolean; loading?: unknown }];

function lastDynamicCall(): DynamicCall {
  expect(dynamicMock).toHaveBeenCalledTimes(1);
  return dynamicMock.mock.calls[0] as unknown as DynamicCall;
}

beforeEach(() => {
  vi.resetModules();
  dynamicMock.mockClear();
});

describe("ReturnNudgeToastLazy", () => {
  it("只在客户端懒加载 real 的 ReturnNudgeToast 导出", async () => {
    const { ReturnNudgeToastLazy } = await import("@/components/return-nudge-toast-lazy");
    const [loader, options] = lastDynamicCall();
    const real = await import("@/components/return-nudge-toast");

    expect(options).toEqual({ ssr: false });
    expect(ReturnNudgeToastLazy).toBeTypeOf("function");
    expect(await loader()).toBe(real.ReturnNudgeToast);
  });
});

describe("SyncSummaryToastLazy", () => {
  it("只在客户端懒加载 real 的 SyncSummaryToast 导出", async () => {
    const { SyncSummaryToastLazy } = await import("@/components/sync-summary-toast-lazy");
    const [loader, options] = lastDynamicCall();
    const real = await import("@/components/sync-summary-toast");

    expect(options).toEqual({ ssr: false });
    expect(SyncSummaryToastLazy).toBeTypeOf("function");
    expect(await loader()).toBe(real.SyncSummaryToast);
  });
});

describe("懒加载包装的 client 指令", () => {
  it("Next 16 要求 ssr:false 只能出现在 client 模块，首行指令不可丢", async () => {
    for (const file of ["return-nudge-toast-lazy.tsx", "sync-summary-toast-lazy.tsx"]) {
      const raw = await readFile(path.join(process.cwd(), "src/components", file), "utf8");
      expect(raw.startsWith('"use client";')).toBe(true);
    }
  });
});
