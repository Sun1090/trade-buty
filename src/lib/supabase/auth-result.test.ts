import { describe, expect, it } from "vitest";
import { AuthApiError, AuthSessionMissingError } from "@supabase/supabase-js";
import { resolveAuthUser } from "./auth-result";

describe("resolveAuthUser", () => {
  it("returns the signed-in user when getUser succeeds", () => {
    expect(
      resolveAuthUser({ data: { user: { id: "user-1", email: "a@b.com" } }, error: null })
    ).toEqual({ id: "user-1", email: "a@b.com" });
  });

  it("treats a missing session as a guest", () => {
    expect(
      resolveAuthUser({ data: { user: null }, error: new AuthSessionMissingError() })
    ).toBeNull();
  });

  it("treats a session-less result without an error as a guest", () => {
    expect(resolveAuthUser({ data: { user: null }, error: null })).toBeNull();
  });

  it("throws on auth failures so unknown identity is never read as guest", () => {
    expect(() =>
      resolveAuthUser({ data: { user: null }, error: new AuthApiError("rate limited", 429, undefined) })
    ).toThrow("rate limited");
    expect(() =>
      resolveAuthUser({ data: { user: null }, error: new Error("network down") })
    ).toThrow("network down");
  });
});
