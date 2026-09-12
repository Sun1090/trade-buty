import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildErrorReportPayload,
  ERROR_REPORT_ENDPOINT,
  reportError,
  reportRouteError,
  sendErrorReport,
} from "./error-report";

describe("reportError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["fatal", "error"],
    ["recoverable", "warn"],
    ["silent", "info"],
  ] as const)("routes %s errors to console.%s", (level, consoleMethod) => {
    const spy = vi.spyOn(console, consoleMethod).mockImplementation(() => undefined);

    reportError(level, "quiz", new Error("generation failed"), { retry: 1 });

    expect(spy).toHaveBeenCalledWith(
      `[err:${level}] quiz: generation failed`,
      { retry: 1 }
    );
  });

  it("serializes non-Error values and omits empty metadata", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    reportError("recoverable", "sync", "offline");

    expect(spy).toHaveBeenCalledWith("[err:recoverable] sync: offline", {});
  });

  it("never throws when the console transport itself fails", () => {
    vi.spyOn(console, "error").mockImplementation(() => {
      throw new Error("console unavailable");
    });

    expect(() => reportError("fatal", "render", new Error("boom"))).not.toThrow();
  });
});

describe("reportRouteError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports at fatal level with the Next.js digest when present", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const error = Object.assign(new Error("render exploded"), { digest: "abc123" });
    reportRouteError(error);

    expect(spy).toHaveBeenCalledWith(
      "[err:fatal] route-error: render exploded",
      { digest: "abc123" }
    );
  });

  it("omits empty digest metadata and honours a custom scope", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    reportRouteError(new Error("root layout exploded"), "global-error");

    expect(spy).toHaveBeenCalledWith(
      "[err:fatal] global-error: root layout exploded",
      {}
    );
  });
});

describe("buildErrorReportPayload", () => {
  it("只保留白名单字段，绝不携带 message/stack/URL/其他 meta", () => {
    const err = Object.assign(new Error("user typed 13800138000"), {
      stack: "at secret (/home/user)",
    });
    const payload = buildErrorReportPayload("fatal", "route-error", err, {
      digest: "abc123",
      url: "https://example.com/secret?token=1",
      message: "raw body",
      retry: 3,
    });
    expect(payload).toEqual({
      level: "fatal",
      scope: "route-error",
      kind: "Error",
      digest: "abc123",
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("13800138000");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("raw body");
    expect(serialized).not.toContain("retry");
  });

  it("silent 档返回 null（不上报）", () => {
    expect(buildErrorReportPayload("silent", "sync", new Error("ignored"))).toBeNull();
  });

  it("非法 scope 返回 null；非 Error 用 typeof 作 kind", () => {
    expect(buildErrorReportPayload("fatal", "has space", new Error("x"))).toBeNull();
    expect(buildErrorReportPayload("recoverable", "sync", "offline")?.kind).toBe("string");
  });

  it("缺失或非法 digest 时省略该字段", () => {
    expect(buildErrorReportPayload("fatal", "route-error", new Error("x"))).toEqual({
      level: "fatal",
      scope: "route-error",
      kind: "Error",
    });
    const tooLong = buildErrorReportPayload("fatal", "route-error", new Error("x"), {
      digest: "z".repeat(65),
    });
    expect(tooLong).toEqual({ level: "fatal", scope: "route-error", kind: "Error" });
  });
});

describe("sendErrorReport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("无 window 时不发任何请求", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    sendErrorReport({ level: "fatal", scope: "route-error", kind: "Error" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("优先 sendBeacon，成功后不再 fetch", () => {
    const beacon = vi.fn().mockReturnValue(true);
    const fetchSpy = vi.fn();
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { sendBeacon: beacon });
    vi.stubGlobal("fetch", fetchSpy);

    sendErrorReport({ level: "fatal", scope: "route-error", kind: "Error", digest: "abc" });

    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0][0]).toBe(ERROR_REPORT_ENDPOINT);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sendBeacon 返回 false 时回退 fetch(keepalive)", () => {
    const beacon = vi.fn().mockReturnValue(false);
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { sendBeacon: beacon });
    vi.stubGlobal("fetch", fetchSpy);

    sendErrorReport({ level: "recoverable", scope: "ai-chat", kind: "Error" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(ERROR_REPORT_ENDPOINT);
    expect(init).toMatchObject({ method: "POST", keepalive: true });
  });

  it("无 sendBeacon 时回退 fetch", () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("fetch", fetchSpy);

    sendErrorReport({ level: "fatal", scope: "route-error", kind: "Error" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("sendBeacon 抛错时回退 fetch 且不向外抛", () => {
    const beacon = vi.fn().mockImplementation(() => {
      throw new Error("beacon exploded");
    });
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { sendBeacon: beacon });
    vi.stubGlobal("fetch", fetchSpy);

    expect(() =>
      sendErrorReport({ level: "fatal", scope: "route-error", kind: "Error" }),
    ).not.toThrow();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("fetch 立即抛错时不向外抛", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => {
      throw new Error("network down");
    }));

    expect(() =>
      sendErrorReport({ level: "fatal", scope: "route-error", kind: "Error" }),
    ).not.toThrow();
  });
});

describe("reportError 远端上报接线", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("fatal/recoverable 触发上报，silent 不触发", () => {
    const beacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { sendBeacon: beacon });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    reportError("fatal", "route-error", new Error("boom"));
    reportError("recoverable", "ai-chat", new Error("nope"));
    reportError("silent", "sync", new Error("ignored"));

    expect(beacon).toHaveBeenCalledTimes(2);
  });
});
