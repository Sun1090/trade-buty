/**
 * 分享卡「分享」按钮的统一流程：绘制 → 交给系统分享面板 → 平台不收文件时退回下载。
 *
 * 抽出来是因为 quiz / replay / streak 三张卡此前的 `handleShare` 逐字相同，
 * 而按钮写的是「分享」、实际只做了一次文件下载——移动端用户点它期望的是微信/Telegram
 * 的分享面板，不是下载目录（同页的里程碑按钮早已是面板优先，见 milestone-share-button）。
 * 埋点按**真实发生的那一步**上报：走面板不补记一条「下载成功」，用户主动取消
 * 既不算成功也不算失败（与里程碑按钮的 AbortError 处理一致）。
 */
import { shareCanvasAsPng, type ShareFileOutcome } from "./download";
import { trackGrowthEvent, type GrowthLocale, type ShareCardKind, type ShareSurface } from "./growth-events";

export type ShareFlowOutcome = ShareFileOutcome;

export interface ShareFlowArgs {
  card: ShareCardKind;
  locale: GrowthLocale;
  surface: ShareSurface;
  /** 退回下载时用的文件名 */
  filename: string;
  /** 分享面板的标题（用按钮同款文案，不另造一句承诺） */
  title: string;
  /** 把卡面画到画布上（三张卡各自的绘制函数） */
  draw: () => Promise<void> | void;
  getCanvas: () => HTMLCanvasElement | null;
}

export async function runShareCardFlow(args: ShareFlowArgs): Promise<ShareFlowOutcome> {
  const { card, locale, surface, filename, title, draw, getCanvas } = args;
  trackGrowthEvent({
    name: "share_card_download",
    card,
    locale,
    surface,
    trigger: "share",
    outcome: "started",
  });
  try {
    await draw();
    const canvas = getCanvas();
    if (!canvas) throw new Error("share canvas unavailable");
    const outcome = await shareCanvasAsPng(canvas, filename, { title });
    // R13.6：拿不到图片就报失败，不进「已分享」分支
    if (outcome === "failed") throw new Error("canvas could not be exported");
    if (outcome === "downloaded") {
      trackGrowthEvent({
        name: "share_card_download",
        card,
        locale,
        surface,
        trigger: "share",
        outcome: "succeeded",
      });
    } else if (outcome === "shared") {
      trackGrowthEvent({
        name: "share_card_shared",
        card,
        locale,
        surface,
        outcome: "succeeded",
      });
    }
    return outcome;
  } catch {
    trackGrowthEvent({
      name: "share_card_download",
      card,
      locale,
      surface,
      trigger: "share",
      outcome: "failed",
    });
    return "failed";
  }
}
