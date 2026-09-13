// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { registerServiceWorker, ServiceWorkerRegistrar } from "./service-worker-registrar";

describe("registerServiceWorker（R13.13）", () => {
  it("does nothing when registration is disabled", async () => {
    const register = vi.fn();
    await expect(registerServiceWorker({ register }, false)).resolves.toBe(
      false,
    );
    expect(register).not.toHaveBeenCalled();
  });

  it("returns false when the browser has no service worker container", async () => {
    await expect(registerServiceWorker(undefined, true)).resolves.toBe(false);
  });

  it("registers /sw.js at root scope and pings for an update", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const register = vi.fn().mockResolvedValue({ update });
    await expect(registerServiceWorker({ register }, true)).resolves.toBe(true);
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("swallows registration failures so the site keeps working", async () => {
    const register = vi.fn().mockRejectedValue(new Error("blocked"));
    await expect(registerServiceWorker({ register }, true)).resolves.toBe(
      false,
    );
  });

  it("stays successful when the post-registration update ping rejects", async () => {
    const update = vi.fn().mockRejectedValue(new Error("offline"));
    const register = vi.fn().mockResolvedValue({ update });
    await expect(registerServiceWorker({ register }, true)).resolves.toBe(true);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("handles registrations that resolve without a registration object", async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    await expect(registerServiceWorker({ register }, true)).resolves.toBe(true);
  });
});

/** 让 `registerServiceWorker()` 的默认 enabled 取值变为 true，走组件里真实的注册路径。 */
function stubProduction() {
  vi.stubEnv("NODE_ENV", "production");
}

/** 把 navigator.serviceWorker 换成可控的假容器。 */
function stubContainer(register = vi.fn().mockResolvedValue({ update: vi.fn() })) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register },
  });
  return register;
}

function stubReadyState(state: DocumentReadyState) {
  Object.defineProperty(document, "readyState", {
    configurable: true,
    get: () => state,
  });
}

describe("ServiceWorkerRegistrar 组件接线（R13.13）", () => {
  beforeEach(() => {
    stubProduction();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    Object.defineProperty(document, "readyState", {
      configurable: true,
      get: () => "complete",
    });
    vi.restoreAllMocks();
  });

  it("readyState=complete 时挂载即注册 /sw.js", async () => {
    stubReadyState("complete");
    const register = stubContainer();
    render(<ServiceWorkerRegistrar />);
    await vi.waitFor(() => expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" }));
  });

  it("readyState 未完成时等 load 事件再注册", async () => {
    stubReadyState("loading");
    const register = stubContainer();
    render(<ServiceWorkerRegistrar />);
    expect(register).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("load"));
    await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1));
  });

  it("load 之前卸载则不注册（避免卸载后副作用）", async () => {
    stubReadyState("loading");
    const register = stubContainer();
    const { unmount } = render(<ServiceWorkerRegistrar />);
    unmount();
    window.dispatchEvent(new Event("load"));
    await Promise.resolve();
    expect(register).not.toHaveBeenCalled();
  });

  it("卸载时移除 load 监听", () => {
    stubReadyState("loading");
    stubContainer();
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<ServiceWorkerRegistrar />);
    unmount();
    expect(remove).toHaveBeenCalledWith("load", expect.any(Function));
  });

  it("没有 serviceWorker 容器时静默降级、不渲染任何 DOM", async () => {
    stubReadyState("complete");
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    const { container } = render(<ServiceWorkerRegistrar />);
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });
});
