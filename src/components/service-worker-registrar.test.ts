import { describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "./service-worker-registrar";

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
