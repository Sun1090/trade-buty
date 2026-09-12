"use client";

import { useState } from "react";
import {
  buildShareUrl,
  fillShareText,
  selectMilestone,
  type MilestoneStats,
} from "@/lib/milestone-share";
import { trackGrowthEvent } from "@/lib/growth-events";

export interface MilestoneShareLabels {
  title: string;
  button: string;
  copied: string;
  copyFailed: string;
  empty: string;
  textTpl: string;
}

/**
 * R13.22 轻量社交：用户主动发起的学习里程碑分享。
 *
 * - 只有达成至少一个里程碑才渲染；没有进度时不出现任何催促文案；
 * - 优先使用系统分享面板（Web Share API），不可用时退回复制文案；
 * - 用户在中途取消系统分享面板视为「不作选择」：不报错、不复制、不写失败事件；
 * - 分享内容只含聚合计数，URL 固定指向公开学习路线。
 */
export function MilestoneShareButton({
  stats,
  locale,
  labels,
}: {
  stats: MilestoneStats;
  locale: "zh" | "en";
  labels: MilestoneShareLabels;
}) {
  const milestone = selectMilestone(stats);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!milestone) return null;

  async function copyToClipboard(text: string): Promise<boolean> {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // 继续尝试 textarea 降级
    }
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }

  async function handleShare() {
    setFailed(false);
    const text = fillShareText(labels.textTpl, stats);
    const url = buildShareUrl(window.location.origin, locale);

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: labels.title, text, url });
        setCopied(false);
        trackGrowthEvent({ name: "milestone_share", locale, channel: "web-share", outcome: "succeeded" });
        return;
      } catch (error) {
        if ((error as { name?: string } | null)?.name === "AbortError") {
          // 用户主动取消：尊重选择，不降级成复制，也不记为失败
          return;
        }
        trackGrowthEvent({ name: "milestone_share", locale, channel: "web-share", outcome: "failed" });
        // 非取消失败继续尝试复制
      }
    }

    const ok = await copyToClipboard(`${text} ${url}`);
    if (ok) {
      setCopied(true);
      trackGrowthEvent({ name: "milestone_share", locale, channel: "clipboard", outcome: "succeeded" });
    } else {
      setFailed(true);
      trackGrowthEvent({ name: "milestone_share", locale, channel: "clipboard", outcome: "failed" });
    }
  }

  return (
    <div className="mt-3" data-testid="milestone-share" data-locale={locale}>
      <p className="text-xs font-medium text-muted">{labels.title}</p>
      <button
        type="button"
        onClick={handleShare}
        data-testid="milestone-share-btn"
        className="mt-2 min-h-10 rounded-full border border-accent/40 bg-accent-dim px-4 py-2 text-xs font-medium text-accent transition hover:bg-accent hover:text-white dark:hover:text-[#06281c]"
      >
        🔗 {labels.button}
      </button>
      <p className="mt-2 text-xs" aria-live="polite">
        {copied && <span className="text-accent">{labels.copied}</span>}
        {failed && <span className="text-red-500" role="alert">{labels.copyFailed}</span>}
      </p>
    </div>
  );
}
