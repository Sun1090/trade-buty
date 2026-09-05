"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CARD_SIZE, drawStreakCard, type ShareLocale } from "@/lib/share-card";
import { downloadCanvasAsPng } from "@/lib/download";
import { CopyLinkButton } from "@/components/copy-link-button";

interface Props {
  currentStreak: number;
  longestStreak: number;
  /** 最近 7 天的活动日期（yyyy-MM-dd 字符串数组；缺日期视为未学习） */
  recentDays: { date: string; active: boolean }[];
  locale: ShareLocale;
  siteName?: string;
  /** R8.4 分享链接 URL（含 origin）；提供时显示「复制链接」按钮 */
  shareUrl?: string;
  labels: {
    share: string;
    previewAlt: string;
    download: string;
    copyLink: string;
    copiedLink: string;
  };
}

/**
 * R8.3 连续学习分享卡：与 R8.1/R8.2 同样的离屏 canvas + share/preview 流程。
 * 当 currentStreak = 0 时按钮禁用（无意义）。
 */
export function StreakShareCard({
  currentStreak,
  longestStreak,
  recentDays,
  locale,
  siteName = "Trade Buty",
  shareUrl,
  labels,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const filename = `trade-buty-streak-${currentStreak}d.png`;
  const disabled = currentStreak <= 0;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const draw = useCallback(async () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CARD_SIZE;
    canvas.height = CARD_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawStreakCard({
      ctx,
      width: CARD_SIZE,
      height: CARD_SIZE,
      currentStreak,
      longestStreak,
      recentDays,
      locale,
      theme: "dark",
      siteName,
      font: locale === "zh" ? '"PingFang SC", "Microsoft YaHei", sans-serif' : "system-ui, sans-serif",
    });
  }, [disabled, currentStreak, longestStreak, recentDays, locale, siteName]);

  async function handleShare() {
    if (disabled) return;
    await draw();
    const canvas = canvasRef.current;
    if (!canvas) return;
    await downloadCanvasAsPng(canvas, filename);
  }

  async function handlePreview() {
    if (disabled) return;
    await draw();
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = canvas.toDataURL("image/png");
    setPreviewUrl(url);
  }

  async function handleDownload() {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!previewUrl) await draw();
    await downloadCanvasAsPng(canvas, filename);
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
        data-testid="streak-share-btn"
        disabled={disabled}
        className="rounded-full border border-accent/40 bg-accent-dim text-accent font-medium px-5 py-2 text-sm hover:bg-accent hover:text-white dark:hover:text-[#06281c] transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        📤 {labels.share}
      </button>
      <button
        type="button"
        onClick={handlePreview}
        data-testid="streak-share-preview-btn"
        disabled={disabled}
        className="rounded-full border border-border-strong text-muted font-medium px-5 py-2 text-sm hover:border-accent/50 hover:text-accent transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        👁 Preview
      </button>
      {shareUrl && (
        <CopyLinkButton
          url={shareUrl}
          label={labels.copyLink}
          copiedLabel={labels.copiedLink}
          testId="streak-share-link-btn"
        />
      )}
      {previewUrl && (
        <div className="basis-full mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs text-faint mb-2 font-mono">{labels.previewAlt}</p>
          <img
            src={previewUrl}
            alt={labels.previewAlt}
            width={CARD_SIZE / 2}
            height={CARD_SIZE / 2}
            className="block max-w-full h-auto rounded-lg border border-[var(--border)]"
          />
          <button
            type="button"
            onClick={handleDownload}
            className="mt-3 rounded-full bg-accent-strong text-white dark:text-[#06281c] font-semibold px-5 py-2 text-sm hover:bg-accent transition"
          >
            ⬇ {labels.download}
          </button>
        </div>
      )}
    </div>
  );
}
