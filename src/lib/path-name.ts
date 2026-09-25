/**
 * 「学习路线」这一面的名字只有一个主人。
 *
 * `/[locale]/path` 的 `<title>`/h1（`i18n.ts` 的 `path.title`）与统计页空态那颗指向它的按钮
 * 都从这里取，否则就会出现「按钮叫 A、点开的页面叫 B」（R16.163 定的是同一个口径）。
 *
 * 为什么单独立一个模块而不是直接从 `i18n.ts` 拿：客户端组件只要这一个字符串，
 * 为该字符串背上整本字典是真实的代价——`check:bundle` 在 `/stats` 上量到 +12KB gzip，
 * 直接把那条路由组的 JS 预算顶穿。
 */
export const PATH_SURFACE_NAME: Record<"zh" | "en", string> = {
  zh: "学习路线",
  en: "Learning Path",
};
