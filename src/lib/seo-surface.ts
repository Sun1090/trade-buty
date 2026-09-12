import data from "./seo-surface.json";

/**
 * R13.17：可索引表面（sitemap / robots.txt / 页面 robots meta）的单一事实来源。
 *
 * 三份产物必须从同一份声明生成，否则会出现「sitemap 收录了 noindex 页面」
 * 或「可索引页面没进 sitemap」这类搜索引擎会直接报错的矛盾。
 * `scripts/check-seo-surface.mjs` 在构建产物上复核三者是否一致。
 *
 * 约定：
 * - `indexable`：静态页面里允许被收录的路径（locale 相对），必须出现在 sitemap。
 * - `noindex`：页面显式声明 `noindex, nofollow` 的路径；这类页面不进 sitemap，
 *   也不应写进 robots.txt 的 Disallow（被 Disallow 挡住爬虫就读不到 noindex）。
 * - `robotsDisallow`：只放「不该被抓取的非页面资源 / 带凭据的回调」，
 *   不用它来表达「不想收录」——那是 `noindex` 的职责。
 */

export type ChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

export interface IndexableSurface {
  /** locale 相对路径，首页为 "" */
  path: string;
  changeFrequency: ChangeFrequency;
  priority: number;
}

export const INDEXABLE_STATIC_SURFACES: readonly IndexableSurface[] =
  data.indexable as IndexableSurface[];

/** 静态页面中显式 noindex 的路径（locale 相对）。 */
export const NOINDEX_STATIC_PATHS: readonly string[] = data.noindex;

/** robots.txt Disallow 规则，按写入顺序排列。 */
export const ROBOTS_DISALLOW: readonly string[] = data.robotsDisallow;
