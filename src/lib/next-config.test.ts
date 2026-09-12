import { describe, it, expect } from "vitest";
import config, {
  CONTENT_CACHE_POLICIES,
  MARKET_CONNECT_SOURCES,
  SERVICE_WORKER_CACHE_POLICY,
} from "../../next.config";

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

/** 命中 source 的具体路由规则（next headers 按 specificity 匹配，此处只断言声明存在） */
function ruleFor(source: string, rules: HeaderRule[]): HeaderRule | undefined {
  return rules.find((r) => r.source === source);
}

describe("next.config 内容产物缓存策略（R10.24）", () => {
  it("headers() 为 name-stable 内容产物声明 revalidate 策略", async () => {
    const rules = (await config.headers()) as HeaderRule[];
    // 两个 name-stable 内容派生文件：内容更新后 URL 不变，禁止长缓存
    for (const policy of CONTENT_CACHE_POLICIES) {
      const rule = ruleFor(policy.source, rules);
      expect(rule, `缺少 ${policy.source} 的缓存规则`).toBeDefined();
      const cc = rule!.headers.find((h) => h.key === "Cache-Control");
      expect(cc?.value).toBe("public, max-age=0, must-revalidate");
    }
  });

  it("CSP 允许行情 REST 与 WebSocket 连接", async () => {
    const rules = (await config.headers()) as HeaderRule[];
    const generic = ruleFor("/:path*", rules);
    const csp = generic!.headers.find(
      (header) => header.key === "Content-Security-Policy"
    )?.value;

    expect(csp).toContain("connect-src");
    for (const source of MARKET_CONNECT_SOURCES) {
      expect(csp).toContain(source);
    }
  });

  it("R13.13 service worker 脚本禁止长缓存（保证离线策略能更新）", async () => {
    const rules = (await config.headers()) as HeaderRule[];
    const rule = ruleFor(SERVICE_WORKER_CACHE_POLICY.source, rules);
    expect(rule, "缺少 /sw.js 的缓存规则").toBeDefined();
    const cc = rule!.headers.find((h) => h.key === "Cache-Control");
    expect(cc?.value).toBe("no-cache");
  });

  it("R7.12 安全头仍覆盖全站通配规则", async () => {
    const rules = (await config.headers()) as HeaderRule[];
    const generic = ruleFor("/:path*", rules);
    expect(generic).toBeDefined();
    const keys = generic!.headers.map((h) => h.key);
    for (const k of [
      "Content-Security-Policy",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
    ]) {
      expect(keys).toContain(k);
    }
  });
});
