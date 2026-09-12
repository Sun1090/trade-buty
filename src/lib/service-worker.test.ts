// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

/**
 * R13.13：直接对 public/sw.js 做行为测试。
 *
 * 这个 worker 是纯浏览器脚本（不经 TS 构建），所以用 vm 沙箱加载真实发布文件，
 * 用手写的最小 Cache/Request 假件驱动 install/activate/fetch，避免测试替身漂移。
 */

const OFFLINE_PATH = path.resolve(process.cwd(), "public/offline.html");
const SW_PATH = path.resolve(process.cwd(), "public/sw.js");
const SW_SOURCE = readFileSync(SW_PATH, "utf8");
const OFFLINE_HTML = readFileSync(OFFLINE_PATH, "utf8");

const ORIGIN = "http://localhost";
const CURRENT_CACHE = "trade-buty-offline-v1";

type WorkerListener = (event: unknown) => void;

class TestRequest {
  readonly url: string;

  constructor(input: string) {
    this.url = new URL(input, ORIGIN).toString();
  }
}

interface Harness {
  dispatch: (type: string, event: unknown) => void;
  cacheStore: Map<string, Response>;
  fetchMock: ReturnType<typeof vi.fn>;
  deleteMock: ReturnType<typeof vi.fn>;
  skipWaiting: ReturnType<typeof vi.fn>;
  claim: ReturnType<typeof vi.fn>;
  openedCaches: string[];
}

function createHarness(
  fetchImpl: (request: unknown) => Promise<Response>
): Harness {
  const listeners = new Map<string, WorkerListener[]>();
  const cacheStore = new Map<string, Response>();
  const openedCaches: string[] = [];
  const cache = {
    add: async (request: TestRequest) => {
      cacheStore.set(
        request.url,
        new Response(OFFLINE_HTML, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        })
      );
    },
    match: async (request: string) =>
      cacheStore.get(new URL(request, ORIGIN).toString()),
  };
  const fetchMock = vi.fn(fetchImpl);
  const deleteMock = vi.fn(async () => true);
  const skipWaiting = vi.fn(async () => undefined);
  const claim = vi.fn(async () => undefined);

  const self = {
    addEventListener: (type: string, listener: WorkerListener) => {
      const list = listeners.get(type) ?? [];
      list.push(listener);
      listeners.set(type, list);
    },
    skipWaiting,
    clients: { claim },
  };
  const caches = {
    open: async (name: string) => {
      openedCaches.push(name);
      return cache;
    },
    keys: async () => [CURRENT_CACHE, "trade-buty-offline-v0"],
    delete: deleteMock,
  };

  vm.runInNewContext(SW_SOURCE, {
    self,
    caches,
    fetch: fetchMock,
    Request: TestRequest,
    Response,
    URL,
    Promise,
    console,
  });

  return {
    dispatch: (type, event) => {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
    cacheStore,
    fetchMock,
    deleteMock,
    skipWaiting,
    claim,
    openedCaches,
  };
}

async function runLifecycle(harness: Harness, type: "install" | "activate") {
  const waits: Promise<unknown>[] = [];
  harness.dispatch(type, {
    waitUntil: (promise: Promise<unknown>) => waits.push(promise),
  });
  await Promise.all(waits);
}

function navigationRequest(url: string) {
  return { url: `${ORIGIN}${url}`, method: "GET", mode: "navigate" };
}

describe("service worker 离线兜底（R13.13）", () => {
  it("安装时只预缓存离线页并立即接管", async () => {
    const h = createHarness(async () => new Response("network"));
    await runLifecycle(h, "install");

    expect([...h.cacheStore.keys()]).toEqual([`${ORIGIN}/offline.html`]);
    expect(h.openedCaches).toEqual([CURRENT_CACHE]);
    expect(h.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it("激活时清理旧版本缓存并 claim 现有客户端", async () => {
    const h = createHarness(async () => new Response("network"));
    await runLifecycle(h, "activate");

    expect(h.deleteMock).toHaveBeenCalledTimes(1);
    expect(h.deleteMock).toHaveBeenCalledWith("trade-buty-offline-v0");
    expect(h.claim).toHaveBeenCalledTimes(1);
  });

  it("在线导航走网络，不返回离线页", async () => {
    const h = createHarness(
      async () => new Response("<html>real page</html>", { status: 200 })
    );
    await runLifecycle(h, "install");

    let responded: Promise<Response> | undefined;
    h.dispatch("fetch", {
      request: navigationRequest("/zh/path"),
      respondWith: (promise: Promise<Response>) => {
        responded = promise;
      },
    });

    const response = await responded!;
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<html>real page</html>");
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
  });

  it("断网导航返回预缓存的离线页", async () => {
    const h = createHarness(async () => {
      throw new TypeError("Failed to fetch");
    });
    await runLifecycle(h, "install");

    let responded: Promise<Response> | undefined;
    h.dispatch("fetch", {
      request: navigationRequest("/zh/knowledge"),
      respondWith: (promise: Promise<Response>) => {
        responded = promise;
      },
    });

    const response = await responded!;
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("离线");
  });

  it("预缓存缺失时也给出最终兜底响应", async () => {
    const h = createHarness(async () => {
      throw new TypeError("Failed to fetch");
    });
    // 故意不跑 install：模拟预缓存失败后 worker 仍已激活的路径
    let responded: Promise<Response> | undefined;
    h.dispatch("fetch", {
      request: navigationRequest("/zh"),
      respondWith: (promise: Promise<Response>) => {
        responded = promise;
      },
    });

    const response = await responded!;
    expect(response.status).toBe(503);
    expect(await response.text()).toContain("Offline");
  });

  it("不拦截非导航请求（API、内容产物、静态资源、POST）", () => {
    const h = createHarness(async () => new Response("network"));
    const respondWith = vi.fn();

    for (const request of [
      { url: `${ORIGIN}/search-index.json`, method: "GET", mode: "cors" },
      { url: `${ORIGIN}/knowledge-assets/a.png`, method: "GET", mode: "no-cors" },
      { url: `${ORIGIN}/api/ai/chat`, method: "POST", mode: "cors" },
      { url: `${ORIGIN}/zh`, method: "POST", mode: "navigate" },
    ]) {
      h.dispatch("fetch", { request, respondWith });
    }

    expect(respondWith).not.toHaveBeenCalled();
    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it("离线页哈希与 worker 声明保持同步（改页必须同步升版本）", () => {
    const declared = /OFFLINE_PAGE_SHA256:\s*([0-9a-f]{64})/.exec(SW_SOURCE)?.[1];
    const actual = createHash("sha256").update(OFFLINE_HTML).digest("hex");

    expect(
      declared,
      "public/sw.js 缺少 OFFLINE_PAGE_SHA256 常量"
    ).toBeDefined();
    expect(
      declared,
      "public/offline.html 变了：更新 sw.js 里的 OFFLINE_PAGE_SHA256 并 bump CACHE_VERSION"
    ).toBe(actual);
  });

  it("worker 不缓存页面 HTML 或 API 响应（只预缓存离线页）", () => {
    // cache.put/cache.add 只允许出现在离线页预缓存路径上。
    expect(SW_SOURCE).not.toMatch(/cache\.put\(/);
    expect((SW_SOURCE.match(/cache\.add\(/g) ?? []).length).toBe(1);
    expect(SW_SOURCE).toContain(`const OFFLINE_URL = "/offline.html";`);
  });
});
