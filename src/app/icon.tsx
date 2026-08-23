import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0a0d14, #10151f)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "120px",
        }}
      >
        {/* K 线蜡烛图品牌标 */}
        <svg width="280" height="280" viewBox="0 0 24 24" fill="none">
          {/* 阳线（涨绿） */}
          <rect x="4" y="7" width="4" height="10" rx="1" fill="#34d399" />
          <rect x="5.5" y="4" width="1" height="16" fill="#34d399" />
          {/* 阴线（跌红） */}
          <rect x="14" y="9" width="4" height="8" rx="1" fill="#f87171" />
          <rect x="15.5" y="6" width="1" height="14" fill="#f87171" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
