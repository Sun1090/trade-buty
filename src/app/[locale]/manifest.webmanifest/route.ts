import { getDict, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";

/**
 * R16.292：按语言出 manifest，`/{locale}/manifest.webmanifest` 各自随页面走。
 *
 * 根级那份（`src/app/manifest.ts`）把 `lang`/`name`/`description`/`start_url` 全钉死在中文，
 * 而 `layout.tsx` 的安装引导在 `/en` 上印的是英文文案：英文访客点「Install」，
 * 装到桌面上的是个中文应用，启动页还把他甩到 `/zh`。
 *
 * **为什么是 route handler 而不是 `app/[locale]/manifest.ts`**（先试过那条路，构建产物里
 * 根本没有这个路由，实测 `/zh/manifest.webmanifest` 404）：Next 16 判定「这是个元数据文件」
 * 用的正则是 `^[\\/]manifest(\.(ts|tsx|…|webmanifest|json))?$`——**锚在 app 根目录**，
 * 所以 `[locale]/manifest.ts` 永远匹配不上（用那��正则在本地复刻验证过：
 * `/manifest` 命中、`/[locale]/manifest` 不命中）。手写一个 Route Handler 不走那层判定，
 * 路径原样注册，构建产物里会出现 `"/[locale]/manifest.webmanifest"`。
 *
 * **为什么不覆盖根级那份**：`id` 必须跨语言**相同**，否则同一台设备上会并存两个「Trade Buty」。
 * 根级保留中文（中文站是默认入口，`start_url` 指向 `/zh`），英文用户由 `layout.tsx` 输出的
 * `<link rel="manifest">` 指向本语言那份。浏览器认显式声明优先于约定路径。
 * 一句话：**入口分流，身份不分家**——`id`/`scope` 描述「哪个应用」，其余字段描述「哪一份界面」。
 */

/** 两份 manifest 的身份字段必须逐字一致，否则设备上会并存两个同名应用。 */
const APP_IDENTITY = {
  id: "/",
  scope: "/",
  dir: "ltr",
  display: "standalone",
  background_color: "#0a0d14",
  theme_color: "#0a0d14",
  categories: ["education", "finance"],
} as const;

const ICONS = [
  { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
  { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" as const },
  { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" as const },
];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ locale: string }> },
): Promise<Response> {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const dict = getDict(locale);

  return new Response(
    JSON.stringify({
      ...APP_IDENTITY,
      icons: ICONS,
      start_url: `/${locale}`,
      lang: locale === "zh" ? "zh-CN" : "en",
      name: dict.appName,
      short_name: dict.appName,
      description: dict.appDescription,
    }),
    {
      headers: {
        "content-type": "application/manifest+json; charset=utf-8",
        // 与根级那份同样长期有效：manifest 不随发布频繁变，浏览器每次导航都重取没有意义。
        "cache-control": "public, max-age=0, must-revalidate",
      },
    },
  );
}
