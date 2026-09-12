// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ShareLandingCtas } from "./share-landing-ctas";

vi.mock("@/lib/growth-events", () => ({ trackGrowthEvent: vi.fn() }));
import { trackGrowthEvent } from "@/lib/growth-events";

const growthTrack = vi.mocked(trackGrowthEvent);

describe("ShareLandingCtas", () => {
  beforeEach(() => {
    cleanup();
    growthTrack.mockClear();
  });

  afterEach(cleanup);

  it("上报 CTA 目的地枚举且保留可达链接", () => {
    render(
      <ShareLandingCtas
        card="quiz"
        locale="en"
        pathLabel="Start learning path →"
        replayLabel="Try replay training"
      />,
    );

    const path = screen.getByRole("link", { name: "Start learning path →" });
    const replay = screen.getByRole("link", { name: "Try replay training" });
    expect(path).toHaveAttribute("href", "/en/path");
    expect(replay).toHaveAttribute("href", "/en/replay");

    path.addEventListener("click", (event) => event.preventDefault());
    replay.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(path);
    fireEvent.click(replay);

    expect(growthTrack).toHaveBeenNthCalledWith(1, {
      name: "share_landing_cta_clicked",
      card: "quiz",
      locale: "en",
      destination: "path",
    });
    expect(growthTrack).toHaveBeenNthCalledWith(2, {
      name: "share_landing_cta_clicked",
      card: "quiz",
      locale: "en",
      destination: "replay",
    });
  });
});
