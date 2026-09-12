import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { clientIp, createRateLimiter } from "./rate-limit";

describe("createRateLimiter (R7.12)", () => {
  it("游客配额用尽后拒绝，retryAfterSec 为正", () => {
    const rl = createRateLimiter({ guestLimit: 2, authedLimit: 5 });
    const t0 = 1_000_000;
    expect(rl.check("ip-1", false, t0).allowed).toBe(true);
    expect(rl.check("ip-1", false, t0 + 1).allowed).toBe(true);
    const third = rl.check("ip-1", false, t0 + 2);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfterSec).toBeGreaterThan(0);
  });

  it("额度随窗口滚动重置", () => {
    const rl = createRateLimiter({ guestLimit: 1, authedLimit: 1, windowMs: 1000 });
    expect(rl.check("k", false, 0).allowed).toBe(true);
    expect(rl.check("k", false, 500).allowed).toBe(false);
    expect(rl.check("k", false, 1000).allowed).toBe(true);
  });

  it("登录用户用更高的 authedLimit", () => {
    const rl = createRateLimiter({ guestLimit: 1, authedLimit: 3 });
    expect(rl.check("u", true, 0).allowed).toBe(true);
    expect(rl.check("u", true, 1).allowed).toBe(true);
    expect(rl.check("u", true, 2).allowed).toBe(true);
    expect(rl.check("u", true, 3).allowed).toBe(false);
  });

  it("不同 key 互不影响", () => {
    const rl = createRateLimiter({ guestLimit: 1, authedLimit: 1 });
    expect(rl.check("a", false, 0).allowed).toBe(true);
    expect(rl.check("b", false, 0).allowed).toBe(true);
    expect(rl.check("a", false, 0).allowed).toBe(false);
  });

  it("remaining 递减反映剩余配额", () => {
    const rl = createRateLimiter({ guestLimit: 3, authedLimit: 3 });
    expect(rl.check("k", false, 0).remaining).toBe(2);
    expect(rl.check("k", false, 0).remaining).toBe(1);
    expect(rl.check("k", false, 0).remaining).toBe(0);
  });
});

describe("clientIp", () => {
  it("取 X-Forwarded-For 第一段并 trim", () => {
    const req = new NextRequest("http://localhost/x", {
      headers: { "x-forwarded-for": " 1.2.3.4 , 5.6.7.8" },
    });
    expect(clientIp(req)).toBe("1.2.3.4");
  });

  it("缺失头时回退 unknown", () => {
    expect(clientIp(new NextRequest("http://localhost/x"))).toBe("unknown");
  });
});
