import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // R13.13：稳定 app 身份 + 显式 scope。/zh 是中文站默认入口（根路径没有页面）。
    id: "/",
    scope: "/",
    lang: "zh-CN",
    dir: "ltr",
    name: "Trade Buty · 免费中立交易教育",
    short_name: "Trade Buty",
    description:
      "面向全球中文用户的免费中立交易教育平台：分级课程 + 真实行情图表与回放训练。",
    start_url: "/zh",
    display: "standalone",
    background_color: "#0a0d14",
    theme_color: "#0a0d14",
    categories: ["education", "finance"],
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
