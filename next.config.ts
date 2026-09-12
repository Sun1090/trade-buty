/** @type {import('next').NextConfig} */

// R7.12：安全头——CSP 允许 Supabase、行情 REST/WS（connect）与内联样式/脚本（Next 必需），
// 图片允许 data: 与全部 https 外链（知识库外链图片）。
export const MARKET_CONNECT_SOURCES = [
  "https://api.binance.com",
  "wss://stream.binance.com:9443",
] as const;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://*.supabase.co";
const supabaseHost = `wss://${supabaseUrl.replace(/^https?:\/\//, "")}`;
const csp = [
  "default-src 'self'",
  `connect-src 'self' ${supabaseUrl} ${supabaseHost} ${MARKET_CONNECT_SOURCES.join(" ")}`,
  "img-src 'self' data: blob: https:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

// R10.24：name-stable 内容产物（内容更新后 URL 不变）必须每次重验证，
// 保证 kb 变更 → 重新部署后立即可见，不被 CDN/浏览器长缓存挡住。
// 与 Vercel/Next 现网默认一致（生产实测 `public, max-age=0, must-revalidate`），
// 显式声明防未来默认值变化造成内容更新不失效的回归。
const contentCacheHeader = {
  key: "Cache-Control",
  value: "public, max-age=0, must-revalidate",
};
// 供单测锁定的缓存策略条目（R10.24）：source → headers
export const CONTENT_CACHE_POLICIES = [
  {
    source: "/search-index.json",
    headers: [contentCacheHeader],
  },
  {
    source: "/knowledge-assets/:path*",
    headers: [contentCacheHeader],
  },
] as const;

const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
      // R10.24：内容产物缓存策略（详见 docs/caching.md §4）
      ...CONTENT_CACHE_POLICIES,
    ];
  },
};

export default nextConfig;
