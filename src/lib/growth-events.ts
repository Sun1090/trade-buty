/**
 * R13.19：分享与邀请转化事件。
 *
 * 当前阶段只写 console/debug 通道：没有网络请求、cookie、localStorage 或
 * 持久化副作用。事件在进入日志前按判别联合重建，调用方即使通过 JS 传入
 * 额外字段也不会泄漏到日志中。
 *
 * 禁止在此模块记录原始 ref、邮箱、账号、章节标题、完整 URL / query 等
 * 可识别或自由文本数据。后续若接入远端收集器，必须先完成隐私审计并更新
 * docs/growth-events.md。
 */

export const GROWTH_EVENT_NAMES = [
  "share_card_download",
  "share_preview_opened",
  "share_link_copy",
  "share_landing_cta_clicked",
  "invite_banner_viewed",
  "invite_banner_dismissed",
  "invite_banner_cleared",
] as const;

export type GrowthEventName = (typeof GROWTH_EVENT_NAMES)[number];
export type ShareCardKind = "quiz" | "replay" | "streak";
export type GrowthLocale = "zh" | "en";
export type ShareSurface = "owner" | "landing";
export type ShareDownloadTrigger = "share" | "preview";
export type GrowthOutcome = "started" | "succeeded" | "failed";

export type GrowthEvent =
  | {
      name: "share_card_download";
      card: ShareCardKind;
      locale: GrowthLocale;
      surface: ShareSurface;
      trigger: ShareDownloadTrigger;
      outcome: GrowthOutcome;
    }
  | {
      name: "share_preview_opened";
      card: ShareCardKind;
      locale: GrowthLocale;
    }
  | {
      name: "share_link_copy";
      card: ShareCardKind;
      locale: GrowthLocale;
      outcome: Extract<GrowthOutcome, "succeeded" | "failed">;
    }
  | {
      name: "share_landing_cta_clicked";
      card: ShareCardKind;
      locale: GrowthLocale;
      destination: "path" | "replay";
    }
  | {
      name: "invite_banner_viewed";
      locale: GrowthLocale;
      source: "url" | "storage";
    }
  | {
      name: "invite_banner_dismissed" | "invite_banner_cleared";
      locale: GrowthLocale;
    };

const SHARE_CARDS = new Set<ShareCardKind>(["quiz", "replay", "streak"]);
const LOCALES = new Set<GrowthLocale>(["zh", "en"]);
const SURFACES = new Set<ShareSurface>(["owner", "landing"]);
const TRIGGERS = new Set<ShareDownloadTrigger>(["share", "preview"]);
const OUTCOMES = new Set<GrowthOutcome>(["started", "succeeded", "failed"]);

function isShareCard(value: unknown): value is ShareCardKind {
  return typeof value === "string" && SHARE_CARDS.has(value as ShareCardKind);
}

function isLocale(value: unknown): value is GrowthLocale {
  return typeof value === "string" && LOCALES.has(value as GrowthLocale);
}

/**
 * 重建为仅含白名单字段的事件。未知 name（例如旧构建或手工调用）返回 null。
 */
export function normalizeGrowthEvent(event: GrowthEvent): GrowthEvent | null {
  if (!event || typeof event !== "object") return null;

  switch (event.name) {
    case "share_card_download":
      if (
        !isShareCard(event.card) ||
        !isLocale(event.locale) ||
        !SURFACES.has(event.surface) ||
        !TRIGGERS.has(event.trigger) ||
        !OUTCOMES.has(event.outcome)
      ) {
        return null;
      }
      return {
        name: "share_card_download",
        card: event.card,
        locale: event.locale,
        surface: event.surface,
        trigger: event.trigger,
        outcome: event.outcome,
      };
    case "share_preview_opened":
      if (!isShareCard(event.card) || !isLocale(event.locale)) return null;
      return {
        name: "share_preview_opened",
        card: event.card,
        locale: event.locale,
      };
    case "share_link_copy":
      if (
        !isShareCard(event.card) ||
        !isLocale(event.locale) ||
        (event.outcome !== "succeeded" && event.outcome !== "failed")
      ) {
        return null;
      }
      return {
        name: "share_link_copy",
        card: event.card,
        locale: event.locale,
        outcome: event.outcome,
      };
    case "share_landing_cta_clicked":
      if (
        !isShareCard(event.card) ||
        !isLocale(event.locale) ||
        (event.destination !== "path" && event.destination !== "replay")
      ) {
        return null;
      }
      return {
        name: "share_landing_cta_clicked",
        card: event.card,
        locale: event.locale,
        destination: event.destination,
      };
    case "invite_banner_viewed":
      if (!isLocale(event.locale) || (event.source !== "url" && event.source !== "storage")) {
        return null;
      }
      return {
        name: "invite_banner_viewed",
        locale: event.locale,
        source: event.source,
      };
    case "invite_banner_dismissed":
      if (!isLocale(event.locale)) return null;
      return { name: "invite_banner_dismissed", locale: event.locale };
    case "invite_banner_cleared":
      if (!isLocale(event.locale)) return null;
      return { name: "invite_banner_cleared", locale: event.locale };
    default:
      return null;
  }
}

/** 永不抛错、永不阻塞主流程的事件出口。 */
export function trackGrowthEvent(event: GrowthEvent): void {
  try {
    const safe = normalizeGrowthEvent(event);
    if (!safe) return;
    console.info("[growth-event]", safe.name, safe);
  } catch {
    // 埋点失败不能影响分享、复制或邀请主流程
  }
}
