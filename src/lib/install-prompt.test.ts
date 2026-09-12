import { describe, expect, it } from "vitest";
import {
  INSTALL_PROMPT_DISMISSED_KEY,
  isStandalone,
  markInstallPromptDismissed,
  readInstallPromptDismissed,
  shouldShowInstallPrompt,
} from "./install-prompt";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("install prompt state (R13.14)", () => {
  it("uses a stable dismissal key and only treats '1' as dismissed", () => {
    const storage = memoryStorage({
      [INSTALL_PROMPT_DISMISSED_KEY]: "1",
    });
    expect(readInstallPromptDismissed(storage)).toBe(true);
    expect(readInstallPromptDismissed(memoryStorage({ [INSTALL_PROMPT_DISMISSED_KEY]: "0" }))).toBe(false);
    expect(readInstallPromptDismissed(undefined)).toBe(false);
  });

  it("persists dismissal and degrades if storage writes fail", () => {
    const storage = memoryStorage();
    expect(markInstallPromptDismissed(storage)).toBe(true);
    expect(storage.getItem(INSTALL_PROMPT_DISMISSED_KEY)).toBe("1");

    expect(
      markInstallPromptDismissed({
        getItem: () => null,
        setItem: () => {
          throw new Error("quota");
        },
      })
    ).toBe(false);
  });

  it("detects both display-mode and iOS standalone", () => {
    expect(
      isStandalone({
        matchMedia: () => ({ matches: true }),
        navigator: {},
      })
    ).toBe(true);
    expect(
      isStandalone({
        matchMedia: () => ({ matches: false }),
        navigator: { standalone: true },
      })
    ).toBe(true);
    expect(
      isStandalone({
        matchMedia: () => ({ matches: false }),
        navigator: { standalone: false },
      })
    ).toBe(false);
  });

  it("fails open when display-mode detection throws", () => {
    expect(
      isStandalone({
        matchMedia: () => {
          throw new Error("unsupported");
        },
        navigator: {},
      })
    ).toBe(false);
  });

  it("shows only when available, not dismissed, and not standalone", () => {
    expect(
      shouldShowInstallPrompt({
        available: true,
        dismissed: false,
        standalone: false,
      })
    ).toBe(true);
    expect(
      shouldShowInstallPrompt({
        available: true,
        dismissed: true,
        standalone: false,
      })
    ).toBe(false);
    expect(
      shouldShowInstallPrompt({
        available: true,
        dismissed: false,
        standalone: true,
      })
    ).toBe(false);
    expect(
      shouldShowInstallPrompt({
        available: false,
        dismissed: false,
        standalone: false,
      })
    ).toBe(false);
  });
});
