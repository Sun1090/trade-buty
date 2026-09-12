"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 篇章完成庆祝：检测从「未完成→完成」的过渡，弹出 emoji confetti。
 *
 * R12.18/内容宪法：庆祝只肯定「学习完成」这一事实——
 * 不用 📈 💎 🚀 💰 等任何暗示行情上涨、暴富、持仓的符号，
 * 也不提收益/胜率等交易结果话术。
 */

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

      if (done && !prevDoneRef.current) {
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
