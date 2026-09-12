"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CARD_SIZE, cardFontFor, drawReplayCard, type ShareLocale } from "@/lib/share-card";
import { downloadCanvasAsPng } from "@/lib/download";
import { CopyLinkButton } from "@/components/copy-link-button";

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
    previewAlt: string;
    download: string;
    copyLink: string;
    copiedLink: string;
    downloadFailed: string;
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
  // R13.6：下载失败可见反馈（canvas 污染/toBlob 失败等）
  const [downloadFailed, setDownloadFailed] = useState(false);
  const filename = `trade-buty-replay-${slugify(symbol)}-${slugify(interval)}.png`;
  // R13.2：预览图 alt 描述卡片内容（准确率/命中/连胜），读屏可复述
  const contentAlt =
    locale === "zh"
      ? `${labels.previewAlt}：回放战绩卡，${symbol} · ${interval}，准确率 ${Math.round(accuracy * 100)}%（命中 ${correct}/${total}），最佳连胜 ${bestStreak}`
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

  async function tryDownload() {
    try {
      await draw();
      const canvas = canvasRef.current;
      if (!canvas) return;
      await downloadCanvasAsPng(canvas, filename);
      setDownloadFailed(false);
    } catch {
      // R13.6：对「伪装的失败」诚实——拿到错误就反馈，不假装成功
      setDownloadFailed(true);
    }
  }

  async function handleShare() {
    await tryDownload();
  }

  async function handlePreview() {
    try {
      await draw();
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = canvas.toDataURL("image/png");
      setPreviewUrl(url);
      setDownloadFailed(false);
    } catch {
      setDownloadFailed(true);
    }
  }

  async function handleDownload() {
    if (!previewUrl) {
      await tryDownload();
      return;
    }
    try {
      await downloadCanvasAsPng(canvasRef.current!, filename);
      setDownloadFailed(false);
    } catch {
      setDownloadFailed(true);
    }
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
        👁 Preview
      </button>
      {shareUrl && (
        <CopyLinkButton
          url={shareUrl}
          label={labels.copyLink}
          copiedLabel={labels.copiedLink}
          testId="replay-share-link-btn"
        />
      )}
      {downloadFailed && (
        <p role="alert" className="basis-full mt-2 text-xs font-medium text-red-500">{labels.downloadFailed}</p>
      )}
      {previewUrl && (
        <div className="basis-full mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs text-faint mb-2 font-mono">{labels.previewAlt}</p>
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
