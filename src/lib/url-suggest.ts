/**
 * R8.11：404 推荐位——按 URL 路径猜最接近的课程。
 *
 * 设计要点：
 * - **纯函数**：本文件不直接 import fs。调用方传 corpus（章节+doc）进来，
 *   保证客户端组件可安全 import（client chunk 不能引 node:fs）
 * - 编辑距离：按字符算（中文按字、英文按字母），无需分词
 * - 打分：综合距离 = slug 距离 + 0.6 × 标题距离（标题距离封顶在输入长度+8），
 *   升序取前 k；同分时按 slug 字典序。篇章与 doc **同权**——`itemDistance` 只看
 *   slug 与标题两段，没有任何「篇章更稀所以更值钱」的加权，别照着这个想象去改排序
 * - 数据源随 locale 切换
 */

export interface SuggestibleItem {
  /** URL 段（如 "getting-started"），用于 slug 距离计算 */
  slug: string;
  /** 标题（如 "入门"），用于标题距离计算 */
  title: string;
  /** 跳转路径（站点内完整 URL，不含 base） */
  href: string;
}

/** 字符级 Levenshtein 距离。O(|a|*|b|) 空间 O(min(|a|,|b|))。
 * 中文按字计算（一个汉字一个 char），效果足够——比整词距离更适合短 slug。 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (a.length > b.length) [a, b] = [b, a];
  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(m + 1);
  let curr = new Array<number>(m + 1);
  for (let i = 0; i <= m; i++) prev[i] = i;
  for (let j = 1; j <= n; j++) {
    curr[0] = j;
    for (let i = 1; i <= m; i++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[i] = Math.min(
        (curr[i - 1] ?? 0) + 1,
        (prev[i] ?? 0) + 1,
        (prev[i - 1] ?? 0) + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[m] ?? 0;
}

/** 把任意输入归一化到字符串距离可比的形式：小写 + 去非字母数字。 */
export function normalizeForDistance(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");
}

/** 综合分：slug 距离权重 1.0，标题距离权重 0.6；越小越像。 */
function itemDistance(input: string, item: SuggestibleItem): number {
  const inorm = normalizeForDistance(input);
  if (!inorm) return Number.POSITIVE_INFINITY;
  const slugDist = levenshtein(inorm, normalizeForDistance(item.slug));
  const titleDist = levenshtein(inorm, normalizeForDistance(item.title));
  const cappedTitle = Math.min(titleDist, inorm.length + 8);
  return slugDist + 0.6 * cappedTitle;
}

/** 候选列表按综合距离升序取前 k。空输入直接返回空数组。 */
function pickClosest(input: string, items: SuggestibleItem[], k: number): SuggestibleItem[] {
  if (!input.trim() || items.length === 0) return [];
  const scored = items
    .map((it) => ({ item: it, dist: itemDistance(input, it) }))
    .sort((a, b) => a.dist - b.dist || a.item.slug.localeCompare(b.item.slug));
  return scored.slice(0, k).map((s) => s.item);
}

/** 把 pathname 切成段并去空。 */
function splitPath(pathname: string): string[] {
  return pathname.split("/").map((s) => decodeURIComponent(s)).filter(Boolean);
}

export interface ParsedKnowledgePath {
  locale: string;
  chapter?: string;
  doc?: string;
}

/** 解析 pathname，提取 `/<locale>/knowledge/<chapter>[/<doc>]` 段。
 * 不匹配（如 `/search`）返回 null，调用方据此隐藏推荐栏。 */
export function parseKnowledgePath(pathname: string): ParsedKnowledgePath | null {
  const segs = splitPath(pathname);
  if (segs.length < 2) return null;
  const locale = segs[0];
  if (locale !== "zh" && locale !== "en") return null;
  if (segs[1] !== "knowledge") return null;
  const chapter = segs[2];
  const doc = segs[3];
  if (!chapter) return { locale };
  return { locale, chapter, doc };
}

/**
 * 解析 pathname → 取最近 N 个推荐。
 * - corpus：服务端组装好的 `SuggestibleItem[]`（章节 + doc）
 * - 策略：
 *   - pathname 匹配知识库路径：限定候选到「同章 doc + 章节自身」→ 按 doc/chapter 段距离排
 *   - 章节段在语料中完全缺失：跨章节猜（用户可能是打错章节名）
 *   - 不匹配、或章节段解码后只剩空白（`/zh/knowledge/%20/x`）：返回空数组。
 *     调用方（`not-found-suggestions.tsx`）据此把整栏收起——这里没有「热门列表」可回退，
 *     语料里也没有任何 popularity 字段，旧的 `pickFallback` 就是拿语料前三条冒充热门，
 *     已连同它的唯一调用点一起删掉。
 *
 * 注意：本函数是纯函数——不读 fs、不读全局状态，可在客户端组件安全调用。
 */
export function suggestFromPath(
  pathname: string,
  corpus: SuggestibleItem[],
  k = 3,
): SuggestibleItem[] {
  const parsed = parseKnowledgePath(pathname);
  if (!parsed || !parsed.chapter || corpus.length === 0) return [];
  const chapterKey = parsed.chapter;
  const inChapter = corpus.filter(
    (it) =>
      it.href === `/${parsed.locale}/knowledge/${chapterKey}` ||
      it.href.startsWith(`/${parsed.locale}/knowledge/${chapterKey}/`),
  );
  if (inChapter.length > 0) {
    return pickClosest(parsed.doc ?? chapterKey, inChapter, k);
  }
  return pickClosest(chapterKey, corpus, k);
}
