"use client";

import { useEffect, useState } from "react";

/** 测验计时器：每题独立计时，显示 mm:ss */
export function QuizTimer({ running }: { running: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setElapsed(0);
      return;
    }
    const t = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;

  return (
    <span className={`font-mono text-xs ${elapsed > 30 ? "text-down" : "text-faint"}`}>
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}