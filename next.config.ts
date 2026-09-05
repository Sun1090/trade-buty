/** @type {import('next').NextConfig} */

// R7.12：安全头——CSP 允许 Supabase（connect/wss）与内联样式/脚本（Next 必需），
// 图片允许 data: 与全部 https 外链（知识库外链图片）。
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://*.supabase.co";
const supabaseHost = `wss://${supabaseUrl.replace(/^https?:\/\//, "")}`;
const csp = [
  "default-src 'self'",
  `connect-src 'self' ${supabaseUrl} ${supabaseHost}`,
  "img-src 'self' data: blob: https:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

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
    ];
  },
};

export default nextConfig;
