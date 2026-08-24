"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 篇章完成庆祝：检测从「未完成→完成」的过渡，弹出 emoji confetti。
 * 用 progress map 对比判断是否刚完成。
 */
export function ChapterCompleteCelebration({
  chapterSlug,
  docCount,
}: {
  chapterSlug: string;
  docCount: number;
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

  const emojis = ["🎉", "🎊", "✨", "🚀", "📈", "💎"];
  return (
    <div className="fixed inset-0 pointer-events-none z-[100] flex items-center justify-center">
      <div className="text-center">
        <p className="text-6xl animate-bounce">🎉</p>
        <p className="mt-4 text-xl font-bold text-accent">篇章完成！</p>
        <div className="mt-2 flex justify-center gap-2">
          {emojis.map((e, i) => (
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
