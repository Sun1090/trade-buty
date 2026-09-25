import { describe, it, expect } from "vitest";
import { AuthRetryableFetchError, AuthUnknownError } from "@supabase/supabase-js";
import { getDict } from "./i18n";
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

  // 下面四组的夹具是 `@supabase/supabase-js` 真抛出来的那几类，不是手搓的形状：
  // 实测 `new AuthRetryableFetchError("Failed to fetch", 0)` 是
  // `{ name: "AuthRetryableFetchError", status: 0, code: undefined }`，
  // 而离线和上游 5xx 用的是同一个类，区别只在 status。
  it("auth-js 的离线包装（status 0）→ network", () => {
    expect(
      classifyOtpError(new AuthRetryableFetchError("Failed to fetch", 0)),
    ).toBe("network");
  });

  it("auth-js 的上游 5xx 包装 → unknown，不叫用户去检查自己的网络", () => {
    expect(
      classifyOtpError(new AuthRetryableFetchError("Bad gateway", 502)),
    ).toBe("unknown");
  });

  // 旧写法在这里补了一句「没有 status 也没有 code 就算网络」，于是这两件没测量过成因的
  // 事都被诊断成「网络异常，请检查连接后重试」：`AuthUnknownError`（status/code 都是
  // undefined），以及 `getSupabaseBrowser()` 在没有 Supabase env 的部署上同步抛的那个裸
  // Error——配置缺失是永久状态，重试永远不可能有用。
  it("AuthUnknownError → unknown，不再替没测量的事宣布成因", () => {
    const err = new AuthUnknownError("x", new Error("y"));
    expect(err.status, "夹具本身要满足「无 status 无 code」，否则这条是空的").toBeUndefined();
    expect(err.code).toBeUndefined();
    expect(classifyOtpError(err)).toBe("unknown");
  });

  it("env 缺失时 getSupabaseBrowser 抛的裸 Error → unknown", () => {
    const err = new Error("Supabase env missing — guard with hasSupabaseEnv() before calling");
    expect(err.name, "裸 Error 的 name 是 Error，落不进网络那几个名字").toBe("Error");
    expect(classifyOtpError(err)).toBe("unknown");
  });

  it("连消息都没有的空对象 → unknown", () => {
    expect(classifyOtpError({})).toBe("unknown");
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

  // 分类和句子是一对：落到 unknown 的那一支必须用一句不点名成因的话，
  // 否则「没测量就说有测量」只是从分类器搬进了字典。
  it("unknown 那一句不点名任何成因", () => {
    for (const locale of ["zh", "en"] as const) {
      const t = getDict(locale).auth;
      expect(t.errorUnknown, `${locale}：这一句要留给「不知道成因为何」`).not.toMatch(
        /网络|连接|network|connection/i,
      );
      // 「网络异常，请检查连接后重试」这句只在 classifyOtpError 判到 network 时渲染
      expect(t.errorNetwork, `${locale}：network 那一句要真的说的是连接`).toMatch(
        locale === "zh" ? /网络|连接/ : /network|connection/i,
      );
    }
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
