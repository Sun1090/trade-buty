import { ImageResponse } from "next/og";
import { decodeQuiz, decodeReplay, decodeStreak, type ShareKind } from "@/lib/share-decode";
import { gradeFromPercent, gradeFromReplayAccuracy, gradeFromStreakDays, type Grade } from "@/lib/share-card";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GRADE_COLORS: Record<Grade, string> = {
  S: "#fbbf24",
  A: "#34d399",
  B: "#38bdf8",
  C: "#94a3b8",
};

interface ShareInfo {
  heading: string;
  grade: Grade | "none";
  gradeColor: string;
  metric: string;
  subline: string;
}

/** 仅自报的分享数据渲染社交卡；沿 R13.3 白名单清洗后的字段。 */
function summarize(kind: ShareKind, path: string): ShareInfo | null {
  if (kind === "quiz") {
    const p = decodeQuiz(path);
    if (!p || p.total <= 0) return null;
    const grade = gradeFromPercent(p.percent);
    return {
      heading: p.locale === "zh" ? "随堂测成绩" : "Quiz Result",
      grade,
      gradeColor: GRADE_COLORS[grade],
      metric: `${p.score}/${p.total}`,
      subline: p.chapterTitle.slice(0, 28),
    };
  }
  if (kind === "replay") {
    const p = decodeReplay(path);
    if (!p || p.total <= 0) return null;
    const grade = gradeFromReplayAccuracy(p.accuracyBps / 10000, p.total);
    return {
      heading: p.locale === "zh" ? "回放战绩" : "Replay Result",
      grade,
      gradeColor: GRADE_COLORS[grade],
      metric: `${Math.round(p.accuracyBps / 100)}%`,
      subline: `${p.symbol} · ${p.interval}`,
    };
  }
  const p = decodeStreak(path);
  if (!p || p.currentStreak <= 0) return null;
  const level = gradeFromStreakDays(p.currentStreak);
  const grade: Grade = level === "none" ? "C" : level;
  return {
    heading: p.locale === "zh" ? "学习连续打卡" : "Study streak",
    grade,
    gradeColor: level === "none" ? "#94a3b8" : GRADE_COLORS[grade],
    metric:
      p.locale === "zh"
        ? `${p.currentStreak} 天 · 最长 ${p.longestStreak} 天`
        : `${p.currentStreak} days · best ${p.longestStreak}`,
    subline: p.locale === "zh" ? "每天都在进步" : "Every day counts",
  };
}

/** R13.5：降级背景——解析失败/字段异常时仍给出品牌卡而不是 500。 */
function renderBrandFallback(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0f0d 0%, #0f2a22 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <span style={{ color: "#34d399", fontSize: 44, fontWeight: 700 }}>Trade Buty</span>
        <span style={{ color: "rgba(233,237,245,0.55)", fontSize: 24, marginTop: 16 }}>
          免费中立交易教育
        </span>
      </div>
    ),
    { ...size },
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ kind: string; path: string }>;
}) {
  // R13.5：解析/解码异常只影响数据部分——统一降级到品牌卡，杜绝爬虫拿到 500。
  // 注意：try 块内不放 JSX（react-hooks/error-boundaries 规则，运行时渲染错误
  // 也抓不到；真实风险在 params 解包与 payload 解码）。
  let info: ShareInfo | null = null;
  try {
    const { kind, path } = await params;
    if (kind !== "quiz" && kind !== "replay" && kind !== "streak") {
      return renderBrandFallback();
    }
    info = summarize(kind as ShareKind, decodeURIComponent(path));
  } catch {
    info = null;
  }
  if (!info) return renderBrandFallback();

  return new ImageResponse(
    (
      <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #0a0f0d 0%, #0f2a22 100%)",
            fontFamily: "sans-serif",
            padding: 48,
          }}
        >
          <span style={{ color: "rgba(233,237,245,0.55)", fontSize: 30 }}>{info.heading}</span>
          <span style={{ color: info.gradeColor, fontSize: 220, fontWeight: 900, lineHeight: 1.1 }}>
            {info.grade === "none" ? "·" : info.grade}
          </span>
          <span style={{ color: "#e9edf5", fontSize: 56, fontWeight: 700 }}>{info.metric}</span>
          <span style={{ color: "rgba(233,237,245,0.7)", fontSize: 32, marginTop: 4 }}>{info.subline}</span>
          <span style={{ color: "#34d399", fontSize: 26, marginTop: 36, fontWeight: 600 }}>Trade Buty</span>
        </div>
      ),
      { ...size },
    );
}
