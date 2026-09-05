"use client";

import { useEffect, useRef, useState } from "react";
import {
  CARD_SIZE,
  drawQuizCard,
  drawReplayCard,
  drawStreakCard,
  type ShareLocale,
} from "@/lib/share-card";
import {
  decodeQuiz,
  decodeReplay,
  decodeStreak,
  type ShareKind,
} from "@/lib/share-decode";
import { downloadCanvasAsPng } from "@/lib/download";

interface Labels {
  quizTitleTpl: string;
  quizDescTpl: string;
  replayTitleTpl: string;
  replayDescTpl: string;
  streakTitleTpl: string;
  streakDescTpl: string;
  invalidQuizTitle: string;
  invalidReplayTitle: string;
  invalidStreakTitle: string;
  invalidBody: string;
  ctaTitle: string;
  ctaBody: string;
  ctaPath: string;
  ctaReplay: string;
}

interface Props {
  kind: ShareKind;
  path: string;
  locale: ShareLocale;
  labels: Labels;
}

/**
 * R8.4 分享落地页预览：服务端已校验 path 与 kind 对应，客户端直接渲染同款 canvas。
 * - SSR 不渲染 canvas（getContext 在 SSR 不存在）；hydration 后立即画
 * - 不重画已有预览（用 ref 守护）
 * - "Download this card" 按钮复用 download.ts
 */
export function ShareCardPreview({ kind, path, locale, labels }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CARD_SIZE;
    canvas.height = CARD_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const font =
      locale === "zh"
        ? '"PingFang SC", "Microsoft YaHei", sans-serif'
        : "system-ui, sans-serif";

    if (kind === "quiz") {
      const p = decodeQuiz(path);
      if (!p) return;
      drawQuizCard({
        ctx,
        width: CARD_SIZE,
        height: CARD_SIZE,
        chapterTitle: p.chapterTitle,
        score: p.score,
        total: p.total,
        percent: p.percent,
        locale,
        theme: "dark",
        siteName: "Trade Buty",
        font,
      });
    } else if (kind === "replay") {
      const p = decodeReplay(path);
      if (!p) return;
      drawReplayCard({
        ctx,
        width: CARD_SIZE,
        height: CARD_SIZE,
        symbol: p.symbol,
        interval: p.interval,
        correct: p.correct,
        total: p.total,
        accuracy: p.accuracyBps / 10000,
        bestStreak: p.bestStreak,
        currentStreak: p.currentStreak,
        locale,
        theme: "dark",
        siteName: "Trade Buty",
        font,
      });
    } else {
      const p = decodeStreak(path);
      if (!p) return;
      drawStreakCard({
        ctx,
        width: CARD_SIZE,
        height: CARD_SIZE,
        currentStreak: p.currentStreak,
        longestStreak: p.longestStreak,
        recentDays: [], // 落地页不展示个人 7 天数据
        locale,
        theme: "dark",
        siteName: "Trade Buty",
        font,
      });
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, [kind, path, locale]);

  async function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const filename = `trade-buty-${kind}-${path.slice(0, 8)}.png`;
    await downloadCanvasAsPng(canvas, filename);
  }

  const textSummary = summarizeText(kind, path, labels, locale);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold">{textSummary.title}</h1>
        <p className="text-sm text-muted leading-relaxed">{textSummary.body}</p>
      </header>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
        <div className="relative w-full overflow-hidden rounded-xl bg-black">
          <canvas
            ref={canvasRef}
            width={CARD_SIZE}
            height={CARD_SIZE}
            data-testid={`share-canvas-${kind}`}
            className="block w-full h-auto"
            style={{ maxWidth: 540, margin: "0 auto" }}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!ready}
            data-testid={`share-download-btn-${kind}`}
            className="rounded-full bg-accent-strong text-white dark:text-[#06281c] font-semibold px-5 py-2 text-sm hover:bg-accent transition disabled:opacity-50"
          >
            ⬇ Download PNG
          </button>
          <span className="text-xs text-faint">
            {ready ? "Ready to share" : "Rendering…"}
          </span>
        </div>
      </div>
    </div>
  );
}

function summarizeText(
  kind: ShareKind,
  path: string,
  labels: Labels,
  locale: ShareLocale,
): { title: string; body: string } {
  if (kind === "quiz") {
    const p = decodeQuiz(path);
    if (!p) return { title: labels.invalidQuizTitle, body: labels.invalidBody };
    const tpl = labels.quizDescTpl;
    return {
      title: labels.quizTitleTpl
        .replace("{chapter}", p.chapterTitle)
        .replace("{grade}", gradeLetter(p.percent))
        .replace("{score}", `${p.score}`)
        .replace("{total}", `${p.total}`),
      body: tpl
        .replace("{chapter}", p.chapterTitle)
        .replace("{score}", `${p.score}`)
        .replace("{total}", `${p.total}`)
        .replace("{percent}", `${Math.round(p.percent)}`),
    };
  }
  if (kind === "replay") {
    const p = decodeReplay(path);
    if (!p) return { title: labels.invalidReplayTitle, body: labels.invalidBody };
    const acc = p.accuracyBps / 100;
    return {
      title: labels.replayTitleTpl
        .replace("{symbol}", p.symbol)
        .replace("{interval}", p.interval)
        .replace("{grade}", replayGradeLetter(acc, p.total))
        .replace("{correct}", `${p.correct}`)
        .replace("{total}", `${p.total}`),
      body: labels.replayDescTpl
        .replace("{symbol}", p.symbol)
        .replace("{correct}", `${p.correct}`)
        .replace("{total}", `${p.total}`)
        .replace("{percent}", `${acc.toFixed(0)}`),
    };
  }
  const p = decodeStreak(path);
  if (!p) return { title: labels.invalidStreakTitle, body: labels.invalidBody };
  return {
    title: labels.streakTitleTpl.replace("{days}", `${p.currentStreak}`),
    body: labels.streakDescTpl
      .replace("{days}", `${p.currentStreak}`)
      .replace("{longest}", `${p.longestStreak}`),
  };
  // 这里的 locale 参数未直接用——为类型完整
  void locale;
}

function gradeLetter(percent: number): string {
  if (percent >= 100) return "S";
  if (percent >= 80) return "A";
  if (percent >= 60) return "B";
  return "C";
}

function replayGradeLetter(accuracy: number, total: number): string {
  if (total < 3) return "C";
  if (accuracy >= 70) return "S";
  if (accuracy >= 60) return "A";
  if (accuracy >= 50) return "B";
  return "C";
}
