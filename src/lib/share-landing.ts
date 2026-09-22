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
  type Grade,
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
 * 把路由里的 `kind` / `path` 原始参数解析成落地页所需的一切。
 * 语义非法（未知 kind、畸形 percent 序列、载荷类型与 kind 不符）一律返回 null，
 * 由调用方决定是 `notFound()` 还是 `robots: noindex`。
 */
export function resolveShareLanding(
  kindRaw: string,
  rawPath: string,
): ResolvedShareLanding | null {
  if (!isShareKind(kindRaw)) return null;
  const path = normalizeShareSegment(rawPath);
  if (path === null) return null;
  if (detectKind(path) !== kindRaw) return null;

  const { title, description, locale } = summarizeForMeta(kindRaw, path);
  return { kind: kindRaw, path, locale, title, description };
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
 * 等级字母 → 落地页用词。阈值判定只有 `@/lib/share-card` 那一份实现，这里只管怎么说；
 * 测验与回放的措辞不同（同是 A，一个说「优秀」一个说「稳健」），所以按类型各一张表。
 */
const GRADE_WORDS: Record<"quiz" | "replay", Record<Grade, Record<Locale, string>>> = {
  quiz: {
    S: { zh: "满分", en: "S" },
    A: { zh: "优秀", en: "A" },
    B: { zh: "及格", en: "B" },
    C: { zh: "待加强", en: "C" },
  },
  replay: {
    S: { zh: "卓越", en: "S" },
    A: { zh: "稳健", en: "A" },
    B: { zh: "及格", en: "B" },
    C: { zh: "待加强", en: "C" },
  },
};

function gradeLabel(percent: number, locale: Locale): string {
  return GRADE_WORDS.quiz[gradeFromPercent(percent)][locale];
}

function replayGradeLabel(accuracy: number, total: number, locale: Locale): string {
  return GRADE_WORDS.replay[gradeFromReplayAccuracy(accuracy, total)][locale];
}
