"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const KlineChart = dynamic(
  () => import("@/components/kline-chart").then((m) => m.KlineChart),
  { ssr: false }
);

export interface ChartEmbedDict {
  heading: string;
  loading: string;
  error: string;
  retry: string;
  disclaimer: string;
}

/** 进入视口后才加载图表代码与数据，避免拖累知识页性能 */
export function LazyChartEmbed({ dict }: { dict: ChartEmbedDict }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          ob.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [visible]);

  return (
    <div ref={ref} className="mt-12">
      <p className="text-sm font-semibold mb-4">📈 {dict.heading}</p>
      {visible ? (
        <KlineChart
          dict={{
            loading: dict.loading,
            error: dict.error,
            retry: dict.retry,
            disclaimer: dict.disclaimer,
          }}
        />
      ) : (
        <div className="h-[360px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] animate-pulse" />
      )}
    </div>
  );
}
