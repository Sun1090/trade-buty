/**
 * R8.4 分享落地页的纯逻辑（无 React / 无 `next/*` 依赖），便于直接单元测试。
 *
 * 为什么单独成模块：`/share/{kind}/{payload}` 是**根级**真实路由（不带语言前缀，
 * locale 编码在载荷里）。Next.js 对动态段 `params` 的百分号解码在 page 与
 * `generateMetadata` 之间并不一致 —— page 拿到的是**编码形态** `v1%7CeyJ...`，
 * 而 `generateMetadata` / `opengraph-image` 拿到的是**解码形态** `v1|eyJ...`。
 * 同一个 URL 因此在两个入口被判定成合法/非法两副面孔：落地页 `detectKind`
 * 解析失败 → 渲染成 404 外壳，而 OG 图正常。分享链接在生产全站失效就是这个根因。
 *
 * 现在把「归一化 + 校验 + 文案」收敛到 `resolveShareLanding`，page / metadata
 * 共用同一条路径，任何入口都不再各解各的。
 */
import {
  decodeQuiz,
  decodeReplay,
  decodeStreak,
  detectKind,
  type ShareKind,
} from "./share-decode";
import { getDict, DEFAULT_LOCALE, type Locale } from "./i18n";
import {
  gradeFromPercent,
  gradeFromReplayAccuracy,
  gradeWord,
} from "./share-card";

/**
 * path 段可能已被 percent-encode（`|` → `%7C`），也可能已经解码过。
 * `decodeURIComponent` 对 base64url 字符集（`A-Za-z0-9-_`）与 `|` 都是幂等的，
 * 所以两种形态都归一化成同一个值；畸形 `%` 序列退化为 null 而不是抛 500。
 */
export function normalizeShareSegment(raw: string): string | null {
  if (typeof raw !== "string") return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

export function isShareKind(s: string): s is ShareKind {
  return s === "quiz" || s === "replay" || s === "streak";
}

export interface ResolvedShareLanding {
  kind: ShareKind;
  /** 归一化后的 path 段（已解码） */
  path: string;
  locale: Locale;
  title: string;
  description: string;
}

/**
 * R16.332：把「为什么解析不出来」分开。此前 `resolveShareLanding` 把两种失败压成
 * 同一个 null，页面于是统一 `notFound()`，用户看到的是整站通用「Page not found」——
 * 而作者其实为「分享链接坏了」写过专门的话（`share.invalidBody`，中英齐全）与三处
 * invalid 分支，全都因为路由在它们之前就降级而**不可达**。
 *
 * 两种失败的处置不同，不能合并：
 * - `unknown-kind`：`/share/{不是三种之一}/...` 是真·错路由，该走整站 not-found，
 *   **不许**被伪装成「你的链接坏了」（那是用户能自己重拼链接的问题，不是我们的）。
 * - `broken-payload`：kind 合法但载荷解不开或类型不符（IM 里链接被截断是常态），
 *   该说清「链接无效」并给出站内出口。
 */
export type ShareLandingResult =
  | (ResolvedShareLanding & { status: "ok" })
  | {
      status: "broken-payload";
      kind: ShareKind;
      locale: Locale;
      title: string;
      description: string;
    }
  | { status: "unknown-kind" };

export function classifyShareLanding(
  kindRaw: string,
  rawPath: string,
): ShareLandingResult {
  if (!isShareKind(kindRaw)) return { status: "unknown-kind" };
  const path = normalizeShareSegment(rawPath);
  if (path === null || detectKind(path) !== kindRaw) {
    // 空段必然解不开，正好走 `summarizeForMeta` 里那三处 invalid 分支：
    // 文案与语言回落的口径只有一份，不在这里另抄一遍「链接无效」。
    const { title, description, locale } = summarizeForMeta(kindRaw, "");
    return { status: "broken-payload", kind: kindRaw, locale, title, description };
  }
  const { title, description, locale } = summarizeForMeta(kindRaw, path);
  return { status: "ok", kind: kindRaw, path, locale, title, description };
}

/**
 * 把路由里的 `kind` / `path` 原始参数解析成落地页所需的一切。
 * 语义非法（未知 kind、畸形 percent 序列、载荷类型与 kind 不符）一律返回 null，
 * 由调用方决定是 `notFound()` 还是 `robots: noindex`。
 */
export function resolveShareLanding(
  kindRaw: string,
  rawPath: string,
): ResolvedShareLanding | null {
  const result = classifyShareLanding(kindRaw, rawPath);
  if (result.status !== "ok") return null;
  // 不把判别字段 `status` 透出去：这个函数的公开形状（五个字段）从 R8.4 起没变过，
  // 换实现不该顺手扩契约。
  const { kind, path, locale, title, description } = result;
  return { kind, path, locale, title, description };
}

/** 用于 meta + 页面标题的纯文本摘要（不渲染卡片）。 */
export function summarizeForMeta(
  kind: ShareKind,
  path: string,
): { title: string; description: string; locale: Locale } {
  const t = getDict(DEFAULT_LOCALE);
  if (kind === "quiz") {
    const p = decodeQuiz(path);
    if (!p) return { title: t.share.invalidQuizTitle, description: t.share.invalidBody, locale: DEFAULT_LOCALE };
    const locale = p.locale;
    const lt = getDict(locale);
    return {
      title: lt.share.quizTitleTpl
        .replace("{chapter}", p.chapterTitle)
        .replace("{grade}", gradeLabel(p.percent, locale))
        .replace("{score}", `${p.score}`)
        .replace("{total}", `${p.total}`),
      description: lt.share.quizDescTpl
        .replace("{chapter}", p.chapterTitle)
        .replace("{score}", `${p.score}`)
        .replace("{total}", `${p.total}`)
        .replace("{percent}", `${Math.round(p.percent)}`),
      locale,
    };
  }
  if (kind === "replay") {
    const p = decodeReplay(path);
    if (!p) return { title: t.share.invalidReplayTitle, description: t.share.invalidBody, locale: DEFAULT_LOCALE };
    const locale = p.locale;
    const lt = getDict(locale);
    // accuracyBps 是万分比（10_000 = 100%）：/100 得到展示用百分数，
    // 分级函数（与 share-card 的 gradeFromReplayAccuracy 同语义）要的是 0–1 比例，
    // 所以这里必须用 /10_000。曾经误传百分数导致所有回放分享页永远显示最高评级。
    const accuracyPercent = p.accuracyBps / 100;
    return {
      title: lt.share.replayTitleTpl
        .replace("{symbol}", p.symbol)
        .replace("{interval}", p.interval)
        .replace("{grade}", replayGradeLabel(p.accuracyBps / 10_000, p.total, locale))
        .replace("{correct}", `${p.correct}`)
        .replace("{total}", `${p.total}`),
      description: lt.share.replayDescTpl
        .replace("{symbol}", p.symbol)
        .replace("{correct}", `${p.correct}`)
        .replace("{total}", `${p.total}`)
        .replace("{percent}", `${accuracyPercent.toFixed(0)}`),
      locale,
    };
  }
  // streak
  const p = decodeStreak(path);
  if (!p) return { title: t.share.invalidStreakTitle, description: t.share.invalidBody, locale: DEFAULT_LOCALE };
  const locale = p.locale;
  const lt = getDict(locale);
  return {
    title: lt.share.streakTitleTpl.replace("{days}", `${p.currentStreak}`),
    description: lt.share.streakDescTpl
      .replace("{days}", `${p.currentStreak}`)
      .replace("{longest}", `${p.longestStreak}`),
    locale,
  };
}

/** 从载荷推断落地页/CTA 使用的语言；非法载荷回退默认语言。 */
export function kindToLocale(kind: ShareKind, path: string): Locale {
  if (kind === "quiz") return decodeQuiz(path)?.locale ?? DEFAULT_LOCALE;
  if (kind === "replay") return decodeReplay(path)?.locale ?? DEFAULT_LOCALE;
  return decodeStreak(path)?.locale ?? DEFAULT_LOCALE;
}

/**
 * 等级字母 → 落地页用词。措辞表与阈值判定都在 `@/lib/share-card`（`gradeWord`），
 * 预览页的 `<h1>` 用的也是它——两处各抄一份，同一轮成绩就会长出两种说法。
 */
function gradeLabel(percent: number, locale: Locale): string {
  return gradeWord(gradeFromPercent(percent), "quiz", locale);
}

function replayGradeLabel(accuracy: number, total: number, locale: Locale): string {
  return gradeWord(gradeFromReplayAccuracy(accuracy, total), "replay", locale);
}
