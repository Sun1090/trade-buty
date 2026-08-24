import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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

const themeInitScript = `(function(){try{var t=localStorage.getItem("tb-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}else{var d=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=d;}}catch(e){}})();`;

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
