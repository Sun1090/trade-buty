import { describe, it, expect } from "vitest";
import {
  classifyOtpError,
  isOtpCoolingDown,
  otpCooldownRemaining,
  OTP_COOLDOWN_MS,
} from "./otp-error";

describe("classifyOtpError", () => {
  it("429 → rate_limited", () => {
    expect(classifyOtpError({ status: 429, message: "rate limit" })).toBe(
      "rate_limited",
    );
  });

  it("over_email_send_rate_limit code → rate_limited", () => {
    expect(
      classifyOtpError({
        status: 400,
        code: "over_email_send_rate_limit",
        message: "rate limit",
      }),
    ).toBe("rate_limited");
  });

  it("message 含 rate limit 关键字 → rate_limited", () => {
    expect(classifyOtpError({ message: "Email rate limit exceeded" })).toBe(
      "rate_limited",
    );
  });

  it("400 + invalid email → invalid_email", () => {
    expect(
      classifyOtpError({
        status: 400,
        code: "email_address_invalid",
        message: "Invalid email",
      }),
    ).toBe("invalid_email");
  });

  it("400 + validation_failed → invalid_email", () => {
    expect(
      classifyOtpError({ status: 400, code: "validation_failed" }),
    ).toBe("invalid_email");
  });

  it("TypeError 抛错 → network", () => {
    expect(classifyOtpError(new TypeError("Failed to fetch"))).toBe("network");
  });

  it("AbortError → network", () => {
    expect(
      classifyOtpError({ name: "AbortError", message: "aborted" }),
    ).toBe("network");
  });

  it("无 status/code 的错误对象 → network", () => {
    expect(classifyOtpError({ message: "weird thing" })).toBe("network");
  });

  it("500 + 内部错 → unknown", () => {
    expect(
      classifyOtpError({ status: 500, code: "internal", message: "oops" }),
    ).toBe("unknown");
  });

  it("null / undefined / 非对象 → unknown", () => {
    expect(classifyOtpError(null)).toBe("unknown");
    expect(classifyOtpError(undefined)).toBe("unknown");
    expect(classifyOtpError("oops")).toBe("unknown");
    expect(classifyOtpError(42)).toBe("unknown");
  });
});

describe("isOtpCoolingDown", () => {
  const t0 = 1_700_000_000_000;

  it("无 lastSentAt → false", () => {
    expect(isOtpCoolingDown(null, t0)).toBe(false);
    expect(isOtpCoolingDown(undefined, t0)).toBe(false);
    expect(isOtpCoolingDown(0, t0)).toBe(false);
  });

  it("now - lastSent < cooldown → true", () => {
    expect(isOtpCoolingDown(t0 - 30_000, t0)).toBe(true);
  });

  it("now - lastSent >= cooldown → false", () => {
    expect(isOtpCoolingDown(t0 - OTP_COOLDOWN_MS, t0)).toBe(false);
    expect(isOtpCoolingDown(t0 - 90_000, t0)).toBe(false);
  });
});

describe("otpCooldownRemaining", () => {
  const t0 = 1_700_000_000_000;

  it("无 lastSentAt → 0", () => {
    expect(otpCooldownRemaining(null, t0)).toBe(0);
  });

  it("刚发完 → 60s（向上取整）", () => {
    expect(otpCooldownRemaining(t0, t0 + 1)).toBe(60);
  });

  it("过 30s → 30s", () => {
    expect(otpCooldownRemaining(t0, t0 + 30_000)).toBe(30);
  });

  it("过 60s → 0（不在冷却）", () => {
    expect(otpCooldownRemaining(t0, t0 + 60_000)).toBe(0);
  });

  it("过 59.5s 向上取整 → 1s", () => {
    expect(otpCooldownRemaining(t0, t0 + 59_500)).toBe(1);
  });
});
