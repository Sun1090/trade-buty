"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CARD_SIZE, drawQuizCard, type ShareLocale } from "@/lib/share-card";
import { downloadCanvasAsPng } from "@/lib/download";

interface Props {
  chapterTitle: string;
  score: number;
  total: number;
  locale: ShareLocale;
  /** 用于卡片 footer 的站点名（中英站点都是 Trade Buty；保持品牌一致） */
  siteName?: string;
  /** i18n 文案键 */
  labels: {
    share: string;
    previewAlt: string;
    download: string;
  };
}

/**
 * R8.1 测验成绩分享卡：
 * - 离屏 <canvas>（hidden），点击 Share 时绘制 → 自动触发 PNG 下载
 * - 提供预览模式：draw 一次后显示，点击 Download 重新触发下载
 * - SSR 安全：所有 canvas 操作包在 useEffect / 事件回调内
 */
export function QuizShareCard({
  chapterTitle,
  score,
  total,
  locale,
  siteName = "Trade Buty",
  labels,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const percent = total > 0 ? (score / total) * 100 : 0;
  const filename = `trade-buty-quiz-${slugify(chapterTitle)}.png`;

  // 卸载预览 URL 避免内存泄漏
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
    drawQuizCard({
      ctx,
      width: CARD_SIZE,
      height: CARD_SIZE,
      chapterTitle,
      score,
      total,
      percent,
      locale,
      theme: "dark",
      siteName,
      font: locale === "zh" ? '"PingFang SC", "Microsoft YaHei", sans-serif' : "system-ui, sans-serif",
    });
  }, [chapterTitle, score, total, percent, locale, siteName]);

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
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {/* 离屏画布：用于绘制 + 下载 */}
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
        data-testid="quiz-share-btn"
        className="rounded-full border border-accent/40 bg-accent-dim text-accent font-medium px-5 py-2 text-sm hover:bg-accent hover:text-white dark:hover:text-[#06281c] transition"
      >
        📤 {labels.share}
      </button>
      <button
        type="button"
        onClick={handlePreview}
        data-testid="quiz-share-preview-btn"
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

/** 把章节标题转成 ASCII 友好的文件名段（去 CJK/特殊字符，留 ASCII 字母数字与连字符）。 */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "quiz";
}
