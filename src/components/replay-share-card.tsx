"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CARD_SIZE, cardFontFor, drawReplayCard, type ShareLocale } from "@/lib/share-card";
import { downloadCanvasAsPng } from "@/lib/download";
import { runShareCardFlow } from "@/lib/share-card-flow";
import { CopyLinkButton } from "@/components/copy-link-button";
import { trackGrowthEvent, type ShareDownloadTrigger } from "@/lib/growth-events";

interface Props {
  symbol: string;
  interval: string;
  correct: number;
  total: number;
  accuracy: number; // 0–1
  bestStreak: number;
  currentStreak: number;
  locale: ShareLocale;
  siteName?: string;
  /** R8.4 分享链接 URL（含 origin） */
  shareUrl?: string;
  labels: {
    share: string;
    /** 「预览卡面」按钮文案：字典里早有这个键，此前被组件写死成英文 */
    preview: string;
    previewAlt: string;
    download: string;
    copyLink: string;
    copiedLink: string;
    copyFailed: string;
    downloadFailed: string;
  previewFailed: string;
  };
}

/**
 * R8.2 回放战绩分享卡：与 R8.1 QuizShareCard 同样的离屏 canvas + 自动下载/预览流程。
 */
export function ReplayShareCard({
  symbol,
  interval,
  correct,
  total,
  accuracy,
  bestStreak,
  currentStreak,
  locale,
  siteName = "Trade Buty",
  shareUrl,
  labels,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // R13.6：失败必须可见；R16.92：还得说对是哪一步——点「预览」失败不能报「下载失败」
  const [failure, setFailure] = useState<null | "download" | "preview">(null);
  const filename = `trade-buty-replay-${slugify(symbol)}-${slugify(interval)}.png`;
  // R13.2：预览图 alt 描述卡片内容（正确率/命中/连胜），读屏可复述
  const contentAlt =
    locale === "zh"
      ? `${labels.previewAlt}：回放战绩卡，${symbol} · ${interval}，正确率 ${Math.round(accuracy * 100)}%（命中 ${correct}/${total}），最佳连胜 ${bestStreak}`
      : `${labels.previewAlt}: replay result card for ${symbol} ${interval}, accuracy ${Math.round(accuracy * 100)}% (${correct}/${total} correct), best streak ${bestStreak}`;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CARD_SIZE;
    canvas.height = CARD_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawReplayCard({
      ctx,
      width: CARD_SIZE,
      height: CARD_SIZE,
      symbol,
      interval,
      correct,
      total,
      accuracy,
      bestStreak,
      currentStreak,
      locale,
      theme: "dark",
      siteName,
      font: cardFontFor(locale),
    });
  }, [symbol, interval, correct, total, accuracy, bestStreak, currentStreak, locale, siteName]);

  async function tryDownload(trigger: ShareDownloadTrigger) {
    trackGrowthEvent({
      name: "share_card_download",
      card: "replay",
      locale,
      surface: "owner",
      trigger,
      outcome: "started",
    });
    try {
      if (trigger === "share") await draw();
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("share canvas unavailable");
      await downloadCanvasAsPng(canvas, filename);
      setFailure(null);
      trackGrowthEvent({
        name: "share_card_download",
        card: "replay",
        locale,
        surface: "owner",
        trigger,
        outcome: "succeeded",
      });
    } catch {
      // R13.6：对「伪装的失败」诚实——拿到错误就反馈，不假装成功
      setFailure("download");
      trackGrowthEvent({
        name: "share_card_download",
        card: "replay",
        locale,
        surface: "owner",
        trigger,
        outcome: "failed",
      });
    }
  }

  async function handleShare() {
    const outcome = await runShareCardFlow({
      card: "replay",
      locale,
      surface: "owner",
      filename,
      title: labels.share,
      draw,
      getCanvas: () => canvasRef.current,
    });
    setFailure(outcome === "failed" ? "download" : null);
  }

  async function handlePreview() {
    try {
      await draw();
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("preview canvas unavailable");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = canvas.toDataURL("image/png");
      setPreviewUrl(url);
      setFailure(null);
      trackGrowthEvent({ name: "share_preview_opened", card: "replay", locale });
    } catch {
      setFailure("preview");
    }
  }

  async function handleDownload() {
    if (!previewUrl) {
      await tryDownload("share");
      return;
    }
    await tryDownload("preview");
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <canvas
        ref={canvasRef}
        width={CARD_SIZE}
        height={CARD_SIZE}
        aria-hidden
        style={{ display: "none" }}
      />
      <button
        type="button"
        onClick={handleShare}
        data-testid="replay-share-btn"
        className="rounded-full border border-accent/40 bg-accent-dim text-accent font-medium px-5 py-2 text-sm min-h-10 hover:bg-accent hover:text-white dark:hover:text-[#06281c] transition"
      >
        📤 {labels.share}
      </button>
      <button
        type="button"
        onClick={handlePreview}
        data-testid="replay-share-preview-btn"
        className="rounded-full border border-border-strong text-muted font-medium px-5 py-2 text-sm min-h-10 hover:border-accent/50 hover:text-accent transition"
      >
        👁 {labels.preview}
      </button>
      {shareUrl && (
        <CopyLinkButton
          url={shareUrl}
          label={labels.copyLink}
          copiedLabel={labels.copiedLink}
          failedLabel={labels.copyFailed}
          testId="replay-share-link-btn"
          onOutcome={(outcome) =>
            trackGrowthEvent({
              name: "share_link_copy",
              card: "replay",
              locale,
              outcome: outcome === "success" ? "succeeded" : "failed",
            })
          }
        />
      )}
      {failure && (
        <p role="alert" className="basis-full mt-2 text-xs font-medium text-red-500">
          {failure === "download" ? labels.downloadFailed : labels.previewFailed}
        </p>
      )}
      {previewUrl && (
        <div className="basis-full mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs text-faint mb-2 font-mono">{labels.previewAlt}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- generated object URL is not optimizable by next/image */}
          <img
            src={previewUrl}
            alt={contentAlt}
            width={CARD_SIZE / 2}
            height={CARD_SIZE / 2}
            className="block max-w-full h-auto rounded-lg border border-[var(--border)]"
          />
          <button
            type="button"
            onClick={handleDownload}
            className="mt-3 rounded-full bg-accent-strong text-white dark:text-[#06281c] font-semibold px-5 py-2 text-sm min-h-10 hover:bg-accent transition"
          >
            ⬇ {labels.download}
          </button>
        </div>
      )}
    </div>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "replay";
}
