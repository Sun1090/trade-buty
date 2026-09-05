import { describe, it, expect } from "vitest";
import { normalizeReturnTo, buildReturnTo, withReturnTo } from "./auth-return";

describe("normalizeReturnTo", () => {
  it("接受当前 locale 前缀的相对路径", () => {
    expect(normalizeReturnTo("/zh/path", "zh")).toBe("/zh/path");
    expect(normalizeReturnTo("/en/knowledge/getting-started", "en")).toBe(
      "/en/knowledge/getting-started",
    );
  });

  it("接受 root + 子段（必须以 / 分隔）", () => {
    expect(normalizeReturnTo("/zh", "zh")).toBe("/zh");
    expect(normalizeReturnTo("/zh/replay", "zh")).toBe("/zh/replay");
  });

  it("拒绝跨 locale（前缀必须严格匹配）", () => {
    expect(normalizeReturnTo("/en/path", "zh")).toBeNull();
    expect(normalizeReturnTo("/zh-CN/path", "zh")).toBeNull();
  });

  it("拒绝纯根 / （避免与无 returnTo 等价）", () => {
    expect(normalizeReturnTo("/", "zh")).toBeNull();
    expect(normalizeReturnTo("/", "en")).toBeNull();
  });

  it("拒绝外部 URL 与协议相对 URL（open redirect 防御）", () => {
    expect(normalizeReturnTo("https://evil.com/path", "zh")).toBeNull();
    expect(normalizeReturnTo("http://evil.com", "zh")).toBeNull();
    expect(normalizeReturnTo("//evil.com/path", "zh")).toBeNull();
    expect(normalizeReturnTo("javascript:alert(1)", "zh")).toBeNull();
    expect(normalizeReturnTo("/\\evil.com", "zh")).toBeNull();
  });

  it("拒绝非 / 开头的输入", () => {
    expect(normalizeReturnTo("zh/path", "zh")).toBeNull();
    expect(normalizeReturnTo("path", "zh")).toBeNull();
    expect(normalizeReturnTo("", "zh")).toBeNull();
    expect(normalizeReturnTo("   ", "zh")).toBeNull();
  });

  it("接受 null / undefined / 非字符串", () => {
    expect(normalizeReturnTo(null, "zh")).toBeNull();
    expect(normalizeReturnTo(undefined, "zh")).toBeNull();
    expect(normalizeReturnTo(123 as unknown as string, "zh")).toBeNull();
  });

  it("剥离首尾空白与控制字符", () => {
    expect(normalizeReturnTo("  /zh/path  ", "zh")).toBe("/zh/path");
    expect(normalizeReturnTo("/zh/path\r\n", "zh")).toBe("/zh/path");
    expect(normalizeReturnTo("\t/zh/path\u0000", "zh")).toBe("/zh/path");
  });

  it("接受带 query 的路径", () => {
    expect(normalizeReturnTo("/zh/path?ref=abc", "zh")).toBe(
      "/zh/path?ref=abc",
    );
    expect(normalizeReturnTo("/zh/path?q=1&z=2", "zh")).toBe(
      "/zh/path?q=1&z=2",
    );
  });

  it("接受带 hash 的路径", () => {
    expect(normalizeReturnTo("/zh/path#section", "zh")).toBe(
      "/zh/path#section",
    );
  });

  it("可选 allowedPrefixes 允许非 locale 前缀（如跨 locale 重定向到登录）", () => {
    // locale=zh 默认会拒绝 /en/foo（跨 locale 防御）
    expect(normalizeReturnTo("/en/auth", "zh")).toBeNull();
    // 显式允许 /en/auth 跨 locale 重定向
    expect(
      normalizeReturnTo("/en/auth", "zh", { allowedPrefixes: ["/en/auth"] }),
    ).toBe("/en/auth");
    // 不在白名单的跨 locale 仍被拒绝
    expect(
      normalizeReturnTo("/en/other", "zh", { allowedPrefixes: ["/en/auth"] }),
    ).toBeNull();
  });

  it("拒绝 /${locale} 拼错（如 /${locale}xxx 无分隔符）", () => {
    expect(normalizeReturnTo("/zhxxx", "zh")).toBeNull();
    expect(normalizeReturnTo("/zhCN", "zh")).toBeNull();
  });
});

describe("buildReturnTo", () => {
  it("包装 normalizeReturnTo：内部一致", () => {
    expect(buildReturnTo("/zh/path", "zh")).toBe("/zh/path");
    expect(buildReturnTo("https://evil.com", "zh")).toBeNull();
    expect(buildReturnTo(null, "zh")).toBeNull();
    expect(buildReturnTo("/en/x", "zh")).toBeNull();
  });
});

describe("withReturnTo", () => {
  it("returnTo=null 时原样返回", () => {
    expect(withReturnTo("/zh/auth", null)).toBe("/zh/auth");
  });

  it("拼接 ?returnTo= 并 URL 编码", () => {
    expect(withReturnTo("/zh/auth", "/zh/path")).toBe("/zh/auth?returnTo=%2Fzh%2Fpath");
    expect(withReturnTo("/zh/auth", "/zh/p?ref=abc")).toBe(
      "/zh/auth?returnTo=%2Fzh%2Fp%3Fref%3Dabc",
    );
  });
});
