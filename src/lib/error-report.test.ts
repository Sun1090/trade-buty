import { afterEach, describe, expect, it, vi } from "vitest";
import { reportError, reportRouteError } from "./error-report";

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
