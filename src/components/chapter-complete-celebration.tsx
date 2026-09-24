"use client";

import { useEffect, useRef, useState } from "react";
import { readProgress, readProgressCompletions } from "@/lib/progress";
import { readDocsInChapter } from "@/lib/learning-overview";

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
  docSlugs,
  locale = "zh",
}: {
  chapterSlug: string;
  /** 这一章现在真有的课文——礼花只数这些，旧键不算 */
  docSlugs: readonly string[];
  locale?: string;
}) {
  const [show, setShow] = useState(false);
  const prevDoneRef = useRef(false);
  // 数组 prop 每次渲染都是新身份，进依赖会让 effect 每帧重跑；比较用拼接串
  const slugKey = docSlugs.join("|");

  useEffect(() => {
    // 已读数与「是否读完本章」走 readDocsInChapter：存储键 ∩ 这一章现在真有的课。
    // 只封顶（readDocsForChapter）挡不住旧键顶数：5 个废键 + 2 篇真课 = 封顶 7/7，
    // 于是同一页课文清单勾着 2/7、礼花却在喊「篇章完成！」。
    // 直接 JSON.parse 原始存储更不行：字符串也有 `.length`，重复键也照算。
    const current = slugKey === "" ? [] : slugKey.split("|");
    const read = readDocsInChapter(readProgress()[chapterSlug], current);
    const done = current.length > 0 && read >= current.length;
    const lastAt = Object.values(readProgressCompletions())
      .filter((entry) => entry.chapter === chapterSlug)
      .reduce((newest, entry) => Math.max(newest, entry.at ?? 0), 0);
    const justFinished = lastAt > 0 && Date.now() - lastAt <= CELEBRATION_FRESH_WINDOW_MS;

    if (done && justFinished && !prevDoneRef.current) {
      setShow(true);
      const t = setTimeout(() => setShow(false), 3000);
      prevDoneRef.current = true;
      return () => clearTimeout(t);
    }
    prevDoneRef.current = done;
  }, [chapterSlug, slugKey]);

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
