import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

// 自托管 Geist（OFL 授权，见 src/fonts/GEIST-LICENSE.txt）——构建期不依赖外网，
// 离线 CI/沙箱可复现构建，同时消除 Google Fonts 往返。
const geistSans = localFont({
  src: "../fonts/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: "../fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Trade Buty · 免费中立交易教育",
    template: "%s · Trade Buty",
  },
  description:
    "面向全球中文用户的免费中立交易教育平台：分级课程（学）× 真实行情图表与回放（练）。不荐股、不导流、不承诺收益。",
  openGraph: {
    type: "website",
    siteName: "Trade Buty",
    title: "Trade Buty · 免费中立交易教育",
    description:
      "分级课程（学）× 真实行情图表与回放（练）。不荐股、不导流、不承诺收益。",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trade Buty · 免费中立交易教育",
    description:
      "分级课程（学）× 真实行情图表与回放（练）。不荐股、不导流、不承诺收益。",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0d14",
  width: "device-width",
  initialScale: 1,
};

const themeInitScript = `(function(){try{var t=localStorage.getItem("tb-theme");if(t==="light"||t==="dark"||t==="sepia"){document.documentElement.dataset.theme=t;}else{var d=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=d;}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        {children}
      </body>
    </html>
  );
}
