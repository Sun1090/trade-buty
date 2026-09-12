import { describe, it, expect, afterEach } from "vitest";
import { isAiGloballyDisabled, hasAiServerEnv, aiEnabledForPage } from "./ai-toggle";

const KEYS = ["NEXT_PUBLIC_AI_ENABLED", "AI_API_KEY"] as const;
const ORIG = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of KEYS) {
    if (ORIG[k] === undefined) delete process.env[k];
    else process.env[k] = ORIG[k];
  }
});

describe("AI 开关（R3.9 / R3.10）", () => {
  it("NEXT_PUBLIC_AI_ENABLED=false 时全局关闭", () => {
    process.env.NEXT_PUBLIC_AI_ENABLED = "false";
    expect(isAiGloballyDisabled()).toBe(true);
  });

  it("NEXT_PUBLIC_AI_ENABLED 为其它值时不算关闭", () => {
    process.env.NEXT_PUBLIC_AI_ENABLED = "true";
    expect(isAiGloballyDisabled()).toBe(false);
    delete process.env.NEXT_PUBLIC_AI_ENABLED;
    expect(isAiGloballyDisabled()).toBe(false);
  });

  it("hasAiServerEnv 取决于 AI_API_KEY 是否存在", () => {
    delete process.env.AI_API_KEY;
    expect(hasAiServerEnv()).toBe(false);
    process.env.AI_API_KEY = "sk-x";
    expect(hasAiServerEnv()).toBe(true);
  });

  it("aiEnabledForPage 需同时有 key 且未被全局关闭", () => {
    process.env.AI_API_KEY = "sk-x";
    delete process.env.NEXT_PUBLIC_AI_ENABLED;
    expect(aiEnabledForPage()).toBe(true);

    process.env.NEXT_PUBLIC_AI_ENABLED = "false";
    expect(aiEnabledForPage()).toBe(false);

    process.env.NEXT_PUBLIC_AI_ENABLED = "true";
    delete process.env.AI_API_KEY;
    expect(aiEnabledForPage()).toBe(false);
  });
});
