import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GROWTH_EVENT_NAMES,
  normalizeGrowthEvent,
  trackGrowthEvent,
  type GrowthEvent,
} from "./growth-events";

const info = vi.spyOn(console, "info").mockImplementation(() => {});

afterEach(() => {
  info.mockClear();
});

describe("growth event contract", () => {
  it("covers every declared event name with the exact same count", () => {
    expect(GROWTH_EVENT_NAMES).toEqual([
      "share_card_download",
      "share_preview_opened",
      "share_link_copy",
      "share_landing_cta_clicked",
      "invite_banner_viewed",
      "invite_banner_dismissed",
      "invite_banner_cleared",
    ]);
  });

  it.each([
    [
      {
        name: "share_card_download",
        card: "quiz",
        locale: "zh",
        surface: "owner",
        trigger: "share",
        outcome: "started",
      },
      "share_card_download",
    ],
    [
      { name: "share_preview_opened", card: "replay", locale: "en" },
      "share_preview_opened",
    ],
    [
      { name: "share_link_copy", card: "streak", locale: "zh", outcome: "succeeded" },
      "share_link_copy",
    ],
    [
      {
        name: "share_landing_cta_clicked",
        card: "quiz",
        locale: "en",
        destination: "path",
      },
      "share_landing_cta_clicked",
    ],
    [
      { name: "invite_banner_viewed", locale: "zh", source: "url" },
      "invite_banner_viewed",
    ],
    [{ name: "invite_banner_dismissed", locale: "en" }, "invite_banner_dismissed"],
    [{ name: "invite_banner_cleared", locale: "zh" }, "invite_banner_cleared"],
  ] satisfies [GrowthEvent, string][])("logs a whitelisted %s", (event, name) => {
    trackGrowthEvent(event);
    expect(info).toHaveBeenCalledWith("[growth-event]", name, normalizeGrowthEvent(event));
  });

  it("strips extra fields, raw refs, URLs and PII before logging", () => {
    const hostile = {
      name: "invite_banner_viewed",
      locale: "zh",
      source: "url",
      ref: "alice",
      email: "alice@example.com",
      url: "https://example.com/?ref=alice",
      chapterTitle: "private title",
    } as unknown as GrowthEvent;

    trackGrowthEvent(hostile);

    const logged = info.mock.calls.at(-1)?.[2];
    expect(logged).toEqual({
      name: "invite_banner_viewed",
      locale: "zh",
      source: "url",
    });
    const serialized = JSON.stringify(info.mock.calls.at(-1));
    expect(serialized).not.toContain("alice");
    expect(serialized).not.toContain("example.com");
    expect(serialized).not.toContain("private title");
  });

  it("rejects unknown runtime event names", () => {
    const unknown = { name: "unknown_event", ref: "alice" } as unknown as GrowthEvent;
    trackGrowthEvent(unknown);
    expect(info).not.toHaveBeenCalled();
  });

  it("rejects unknown runtime enum values instead of logging them", () => {
    const invalid = {
      name: "share_card_download",
      card: "email",
      locale: "fr",
      surface: "remote",
      trigger: "auto",
      outcome: "maybe",
      ref: "alice",
    } as unknown as GrowthEvent;
    trackGrowthEvent(invalid);
    expect(info).not.toHaveBeenCalled();
  });

  it("never throws when console.info throws", () => {
    info.mockImplementationOnce(() => {
      throw new Error("console unavailable");
    });
    expect(() =>
      trackGrowthEvent({
        name: "invite_banner_cleared",
        locale: "en",
      }),
    ).not.toThrow();
  });
});
