import { describe, it, expect, vi } from "vitest";
import { measureFps, REPLAY_REDUCED_CANDLES } from "./perf";

describe("measureFps（R7.3）", () => {
  it("无 rAF 环境（SSR/node）视为正常 60fps", async () => {
    expect(await measureFps(100)).toBe(60);
  });

  it("按 rAF 次数计算帧率（每帧 100ms → 10fps）", async () => {
    let now = 0;
    vi.stubGlobal("window", {});
    vi.stubGlobal("performance", { now: () => now });
    vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => {
      now += 100;
      cb(now);
      return 1;
    });
    const fps = await measureFps(2000);
    vi.unstubAllGlobals();
    expect(fps).toBe(10);
  });

  it("降级常量合理", () => {
    expect(REPLAY_REDUCED_CANDLES).toBeGreaterThan(50);
  });
});
