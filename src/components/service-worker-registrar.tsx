"use client";

import { useEffect } from "react";

type ServiceWorkerRegistrationLike = {
  update?: () => Promise<unknown>;
};

export type ServiceWorkerContainerLike = {
  register: (
    scriptURL: string,
    options?: { scope?: string }
  ) => Promise<ServiceWorkerRegistrationLike | undefined>;
};

function defaultContainer(): ServiceWorkerContainerLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  const container = navigator.serviceWorker as
    | ServiceWorkerContainerLike
    | undefined;
  return container ?? undefined;
}

/**
 * R13.13：注册离线兜底 worker。
 *
 * - 仅生产环境注册：开发时避免缓存/生命周期噪音，测试环境不隐式注册。
 * - 注册失败不抛出：站点在无 Service Worker 时保持全部功能，只是没有离线兜底。
 * - 显式 `scope: "/"`，与 public/sw.js 中的导航兜底范围一致。
 */
export async function registerServiceWorker(
  container: ServiceWorkerContainerLike | undefined = defaultContainer(),
  enabled: boolean = process.env.NODE_ENV === "production"
): Promise<boolean> {
  if (!enabled || !container?.register) return false;
  try {
    const registration = await container.register("/sw.js", { scope: "/" });
    // 部署后主动检查一次新 worker；失败不影响当前页面。
    void registration?.update?.().catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) void registerServiceWorker();
    };
    // 放到 load 之后，避免和首屏 hydration/关键请求抢带宽。
    if (document.readyState === "complete") {
      run();
      return () => {
        cancelled = true;
      };
    }
    window.addEventListener("load", run, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", run);
    };
  }, []);

  return null;
}
