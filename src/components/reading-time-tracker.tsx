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
    let hidden = false;

    function start() {
      if (interval) return;
      interval = setInterval(() => {
        if (!hidden) {
          addReadingTime(chapterRef.current, docRef.current, 5);
        }
      }, 5000);
    }

    function stop() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    }

    function onVisibilityChange() {
      hidden = document.hidden;
    }

    start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
