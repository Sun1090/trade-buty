import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL = process.env.NEXT_PUBLIC_SITE_URL;

function restoreEnv() {
  if (ORIGINAL === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL;
  }
}

afterEach(() => {
  restoreEnv();
  vi.resetModules();
});

describe("SITE_URL", () => {
  it("uses NEXT_PUBLIC_SITE_URL when it is configured", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.example.test";
    vi.resetModules();
    const { SITE_URL } = await import("./site");
    expect(SITE_URL).toBe("https://staging.example.test");
  });

  it("falls back to the production domain when the env var is absent", async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    vi.resetModules();
    const { SITE_URL } = await import("./site");
    expect(SITE_URL).toBe("https://trade-buty.vercel.app");
  });
});
