"use client";

import { useEffect, useRef, useState } from "react";
import { readProgressCompletions } from "@/lib/progress";

/**
 * 篇章完成庆祝：检测从「未完成→完成」的过渡，弹出 emoji confetti。
 *
 * R12.18/内容宪法：庆祝只肯定「学习完成」这一事实——
 * 不用 📈 💎 🚀 💰 等任何暗示行情上涨、暴富、持仓的符号，
 * 也不提收益/胜率等交易结果话术。
 *
 * 「刚完成」用 `tb-progress-completions` 里最近一次阅读的时间戳判断，而不是「这次挂载读到
 * 的进度是满的」：后者会让用户在几周后随便点开一篇已学完的篇章目录页时再放一次礼花，
 * 对着一个早已完成的成就说「篇章完成！」是假反馈。窗口也顺带覆盖了真实流程——读完最后
 * 一篇再回落/跳转到章节页只隔几秒。云端同步来、本机没有阅读记录的进度不庆祝：那不是在
 * 这台设备上刚完成的。
 */
export const CELEBRATION_FRESH_WINDOW_MS = 10 * 60 * 1000;

const TITLES: Record<string, string> = {
  zh: "篇章完成！",
  en: "Chapter complete!",
};

/** 学习向中性符号（刻意排除交易/收益暗示 emoji） */
export const CELEBRATION_EMOJIS = ["🎉", "📖", "✨", "✅", "📚", "🎓"] as const;

export function ChapterCompleteCelebration({
  chapterSlug,
  docCount,
  locale = "zh",
}: {
  chapterSlug: string;
  docCount: number;
  locale?: string;
}) {
  const [show, setShow] = useState(false);
  const prevDoneRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tb-progress");
      const progress = raw ? JSON.parse(raw) : {};
      const read = progress[chapterSlug]?.length ?? 0;
      const done = read >= docCount;
      const lastAt = Object.values(readProgressCompletions())
        .filter((entry) => entry.chapter === chapterSlug)
        .reduce((newest, entry) => Math.max(newest, entry.at ?? 0), 0);
      const justFinished =
        lastAt > 0 && Date.now() - lastAt <= CELEBRATION_FRESH_WINDOW_MS;

      if (done && justFinished && !prevDoneRef.current) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShow(true);
        const t = setTimeout(() => setShow(false), 3000);
        prevDoneRef.current = true;
        return () => clearTimeout(t);
      }
      prevDoneRef.current = done;
    } catch {
      // ignore
    }
  }, [chapterSlug, docCount]);

  if (!show) return null;

  const title = TITLES[locale] ?? TITLES.zh;
  return (
    <div
      className="fixed inset-0 pointer-events-none z-[100] flex items-center justify-center"
      role="status"
      aria-label={title}
    >
      <div className="text-center">
        <p className="text-6xl animate-bounce" aria-hidden>🎉</p>
        <p className="mt-4 text-xl font-bold text-accent">{title}</p>
        <div className="mt-2 flex justify-center gap-2" aria-hidden>
          {CELEBRATION_EMOJIS.map((e, i) => (
            <span
              key={i}
              className="text-2xl"
              style={{
                animation: `fall 2s ease-in ${i * 0.15}s forwards`,
                position: "absolute",
                left: `${50 + (i - 2.5) * 12}%`,
                top: "40%",
              }}
            >
              {e}
            </span>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes fall {
          0% { transform: translateY(-20px); opacity: 1; }
          100% { transform: translateY(200px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
