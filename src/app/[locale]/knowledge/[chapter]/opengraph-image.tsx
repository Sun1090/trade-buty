import { ImageResponse } from "next/og";
import { getChapter } from "@/lib/content";
import { DEFAULT_LOCALE } from "@/lib/i18n";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { locale: string; chapter: string } }) {
  const { locale, chapter: slug } = params;
  const data = getChapter(locale || DEFAULT_LOCALE, slug);
  const title = data?.chapter.title ?? "Trade Buty";
  const tagline = data?.chapter.tagline ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0a0d14 0%, #10151f 100%)",
          padding: "60px 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* 品牌 */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="7" width="4" height="10" rx="1" fill="#34d399" />
            <rect x="5.5" y="4" width="1" height="16" fill="#34d399" />
            <rect x="14" y="9" width="4" height="8" rx="1" fill="#f87171" />
            <rect x="15.5" y="6" width="1" height="14" fill="#f87171" />
          </svg>
          <span style={{ color: "#e9edf5", fontSize: 28, fontWeight: 600 }}>
            Trade Buty
          </span>
          <span style={{ color: "#34d399", fontSize: 22, marginLeft: 8 }}>
            免费中立交易教育
          </span>
        </div>
        {/* 标题 */}
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
          <span style={{ color: "#34d399", fontSize: 24, fontWeight: 500, marginBottom: 16 }}>
            📖 {data ? `${data.chapter.docCount ?? ""} 篇课程` : ""}
          </span>
          <span style={{ color: "#e9edf5", fontSize: 56, fontWeight: 700, lineHeight: 1.2, maxWidth: 900 }}>
            {title}
          </span>
          {tagline && (
            <span style={{ color: "rgba(233,237,245,0.55)", fontSize: 28, marginTop: 20, maxWidth: 800 }}>
              {tagline}
            </span>
          )}
        </div>
        {/* 底部 */}
        <div style={{ display: "flex", alignItems: "center", gap: 24, borderTop: "1px solid rgba(233,237,245,0.09)", paddingTop: 24 }}>
          <span style={{ color: "rgba(233,237,245,0.38)", fontSize: 22 }}>
            不荐股 · 不导流 · 不承诺收益
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
