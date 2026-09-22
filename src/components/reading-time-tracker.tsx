"use client";

import { useEffect, useRef } from "react";
import { addReadingTime } from "@/lib/reading-time";

/**
 * 阅读时长追踪器：挂在单课页，每 5 秒累加一次停留时间。
 * 页面隐藏时停止，回来继续。
 */
export function ReadingTimeTracker({
  chapter,
  doc,
}: {
  chapter: string;
  doc: string;
}) {
  const chapterRef = useRef(chapter);
  const docRef = useRef(doc);

  useEffect(() => {
    chapterRef.current = chapter;
    docRef.current = doc;
  }, [chapter, doc]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    interval = setInterval(() => {
      // 读实时的 document.hidden，而不是把结果缓存成 visibilitychange 回调里的变量：
      // 那个事件只在「切换」时触发，所以标签在后台挂载（点击链接后没切过去看）时，
      // 缓存值会停在初始的 false，于是一篇根本没人读过的课照样累计学习时长。
      if (!document.hidden) {
        addReadingTime(chapterRef.current, docRef.current, 5);
      }
    }, 5000);

    return () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };
  }, []);

  return null;
}
