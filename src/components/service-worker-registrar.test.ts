// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  registerServiceWorker,
  type ServiceWorkerContainerLike,
} from "@/components/service-worker-registrar";

describe("registerServiceWorker（R13.13）", () => {
  it("生产环境下以根作用域注册 /sw.js 并触发更新检查", async () => {
    const update = vi.fn(async () => undefined);
    const register = vi.fn(async () => ({ update }));
    const container: ServiceWorkerContainerLike = { register };

    await expect(registerServiceWorker(container, true)).resolves.toBe(true);
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("开发/测试环境不注册", async () => {
    const register = vi.fn(async () => ({}));
    await expect(registerServiceWorker({ register }, false)).resolves.toBe(
      false
    );
    expect(register).not.toHaveBeenCalled();
  });

  it("浏览器不支持 Service Worker 时静默跳过", async () => {
    await expect(registerServiceWorker(undefined, true)).resolves.toBe(false);
  });

  it("注册失败不抛出（无 SW 时站点保持可用）", async () => {
    const register = vi.fn(async () => {
      throw new Error("SecurityError");
    });
    await expect(registerServiceWorker({ register }, true)).resolves.toBe(
      false
    );
  });

  it("更新检查失败不影响注册结果", async () => {
    const update = vi.fn(async () => {
      throw new Error("offline");
    });
    const register = vi.fn(async () => ({ update }));
    await expect(registerServiceWorker({ register }, true)).resolves.toBe(true);
    // 让 update() 的 rejection 处理跑完，确保没有 unhandled rejection
    await Promise.resolve();
  });
});
