"use client";

import { trackGrowthEvent } from "@/lib/growth-events";
import type { GrowthLocale, ShareCardKind } from "@/lib/growth-events";

interface Props {
  card: ShareCardKind;
  locale: GrowthLocale;
  pathLabel: string;
  replayLabel: string;
}

/** R13.19：分享落地页 CTA 只上报目的地枚举，不上报完整 URL 或来源参数。 */
export function ShareLandingCtas({ card, locale, pathLabel, replayLabel }: Props) {
  function track(destination: "path" | "replay") {
    trackGrowthEvent({ name: "share_landing_cta_clicked", card, locale, destination });
  }

  return (
    <>
      <a
        href={`/${locale}/path`}
        onClick={() => track("path")}
        className="rounded-full bg-accent-strong text-white dark:text-[#06281c] font-semibold px-5 py-2 text-sm hover:bg-accent transition"
      >
        {pathLabel}
      </a>
      <a
        href={`/${locale}/replay`}
        onClick={() => track("replay")}
        className="rounded-full border border-[var(--accent)]/40 bg-[var(--surface)] text-accent font-medium px-5 py-2 text-sm hover:border-accent/60 transition"
      >
        {replayLabel}
      </a>
    </>
  );
}
