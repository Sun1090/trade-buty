"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CARD_SIZE, drawReplayCard, type ShareLocale } from "@/lib/share-card";
import { downloadCanvasAsPng } from "@/lib/download";

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
  labels: {
    share: string;
    previewAlt: string;
    download: string;
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
  labels,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const filename = `trade-buty-replay-${slugify(symbol)}-${slugify(interval)}.png`;

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
      font: locale === "zh" ? '"PingFang SC", "Microsoft YaHei", sans-serif' : "system-ui, sans-serif",
    });
  }, [symbol, interval, correct, total, accuracy, bestStreak, currentStreak, locale, siteName]);

  async function handleShare() {
    await draw();
    const canvas = canvasRef.current;
    if (!canvas) return;
    await downloadCanvasAsPng(canvas, filename);
  }

  async function handlePreview() {
    await draw();
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = canvas.toDataURL("image/png");
    setPreviewUrl(url);
  }

  async function handleDownload() {
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
        data-testid="replay-share-btn"
        className="rounded-full border border-accent/40 bg-accent-dim text-accent font-medium px-5 py-2 text-sm hover:bg-accent hover:text-white dark:hover:text-[#06281c] transition"
      >
        📤 {labels.share}
      </button>
      <button
        type="button"
        onClick={handlePreview}
        data-testid="replay-share-preview-btn"
        className="rounded-full border border-border-strong text-muted font-medium px-5 py-2 text-sm hover:border-accent/50 hover:text-accent transition"
      >
        👁 Preview
      </button>
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

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "replay";
}
