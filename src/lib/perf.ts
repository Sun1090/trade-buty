/**
 * R7.3：低端机性能检测——测量指定时长的平均帧率。
 * < 阈值（如 24fps）时上层 UI 自动降密度（回放减点数）。
 */
export function measureFps(durationMs = 2000): Promise<number> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof requestAnimationFrame !== "function") {
      resolve(60); // SSR / 测试环境视为正常
      return;
    }
    let frames = 0;
    const start = performance.now();
    function tick() {
      frames++;
      if (performance.now() - start >= durationMs) {
        resolve(Math.round((frames * 1000) / (performance.now() - start)));
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

/** 低端机帧率阈值（低于此值触发降级） */
export const LOW_END_FPS_THRESHOLD = 24;

/** 回放降级后的可见 K 线上限 */
export const REPLAY_REDUCED_CANDLES = 150;
