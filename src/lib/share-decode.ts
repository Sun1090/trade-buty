/**
 * R8.4 分享链接解码/编码。
 *
 * URL 设计：
 *   /share/quiz/{chapterSlug}-{base64payload}
 *   /share/replay/{payload}
 *   /share/streak/{payload}
 *
 * payload 编码原则：
 *   - 全部用 base64url（-/_）便于 URL 直接放 path 段
 *   - 前缀一个 1 字符 version（v1=目前格式），将来调整时便于兼容
 *   - quiz: v1|b64(JSON {chapterTitle, score, total, percent, locale})
 *   - replay: v1|b64(JSON {symbol, interval, correct, total, accuracy-bps, bestStreak, currentStreak, locale})
 *   - streak: v1|b64(JSON {currentStreak, longestStreak, locale})
 *
 * 不在 URL 里塞 7 天日期数组（太大）—— streak 的 recentDays 在落地页用 placeholder 代替，
 * 或省略不放（分享的是 streak 数字本身 + 最长，7 天是个人数据）。
 */

export type ShareKind = "quiz" | "replay" | "streak";

export interface QuizPayload {
  chapterTitle: string;
  score: number;
  total: number;
  /** 0–100，允许小数 */
  percent: number;
  locale: "zh" | "en";
}

export interface ReplayPayload {
  symbol: string;
  interval: string;
  correct: number;
  total: number;
  /** 0–100（避免浮点误差，乘 10000 存为 bps = basis points） */
  accuracyBps: number;
  bestStreak: number;
  currentStreak: number;
  locale: "zh" | "en";
}

export interface StreakPayload {
  currentStreak: number;
  longestStreak: number;
  locale: "zh" | "en";
}

export type Payload = QuizPayload | ReplayPayload | StreakPayload;

const VERSION = "v1";
const SEP = "|";

/** 标准 base64url 编码（浏览器与 SSR 都能跑）。 */
function b64urlEncode(s: string): string {
  // Node 与浏览器都支持 Buffer.from + btoa；先尝试 Buffer（SSR/Node）
  if (typeof Buffer !== "undefined") {
    return Buffer.from(s, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  if (typeof Buffer !== "undefined") {
    return Buffer.from(b64, "base64").toString("utf8");
  }
  return decodeURIComponent(escape(atob(b64)));
}

/** 拼接成 URL-safe path 段：v1|base64url(json) */
function pack(json: unknown): string {
  return `${VERSION}${SEP}${b64urlEncode(JSON.stringify(json))}`;
}

/** 拆解路径段；返回 null 表示非法输入。 */
function unpack(segment: string): unknown | null {
  if (!segment || segment.length < 4) return null;
  const sepIdx = segment.indexOf(SEP);
  if (sepIdx <= 0 || sepIdx >= segment.length - 1) return null;
  const version = segment.slice(0, sepIdx);
  const b64 = segment.slice(sepIdx + 1);
  if (version !== VERSION) return null; // 未来版本切换时直接拒绝
  try {
    return JSON.parse(b64urlDecode(b64));
  } catch {
    return null;
  }
}

// ────────── R13.3：字段白名单化与清洗 ──────────
//
// 守卫只校验「必填键存在且类型对」，不阻止额外键混入。
// 分享链接本质是用户自报的不可信输入：解码时必须
//   1) 只放行白名单键（将来新增的个人字段绝不能经 URL 回流到落地页/OG）
//   2) 修剪文本（控制字符、长度上限）
//   3) 钳制数值到展示友好范围

/** 剥离控制字符 + 截断（React/canvas 都会原样渲染，长度是主要风险） */
function sanitizeText(value: string, maxChars: number): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return cleaned.slice(0, maxChars);
}

const clampInt = (value: number, max: number): number =>
  !Number.isFinite(value) || value < 0 ? 0 : Math.min(max, Math.round(value));

const clampPercent = (value: number): number =>
  !Number.isFinite(value) ? 0 : Math.min(200, Math.max(0, value));

const sanitizeLocale = (value: unknown): "zh" | "en" =>
  value === "en" ? "en" : "zh";

// ────────── 类型守卫 ──────────

function isQuizPayload(x: unknown): x is QuizPayload {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.chapterTitle === "string" &&
    typeof o.score === "number" &&
    typeof o.total === "number" &&
    typeof o.percent === "number" &&
    (o.locale === "zh" || o.locale === "en")
  );
}

function isReplayPayload(x: unknown): x is ReplayPayload {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.symbol === "string" &&
    typeof o.interval === "string" &&
    typeof o.correct === "number" &&
    typeof o.total === "number" &&
    typeof o.accuracyBps === "number" &&
    typeof o.bestStreak === "number" &&
    typeof o.currentStreak === "number" &&
    (o.locale === "zh" || o.locale === "en")
  );
}

function isStreakPayload(x: unknown): x is StreakPayload {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.currentStreak === "number" &&
    typeof o.longestStreak === "number" &&
    (o.locale === "zh" || o.locale === "en")
  );
}

// ────────── 公开 API ──────────

export function encodeQuiz(p: QuizPayload): string {
  return pack(p);
}

export function encodeReplay(p: ReplayPayload): string {
  return pack(p);
}

export function encodeStreak(p: StreakPayload): string {
  return pack(p);
}

/** 把 path 段解码成强类型 payload；非法输入返回 null；返回对象只含白名单键。 */
export function decodeQuiz(segment: string): QuizPayload | null {
  const x = unpack(segment);
  if (!isQuizPayload(x)) return null;
  return {
    chapterTitle: sanitizeText(x.chapterTitle, 60),
    score: clampInt(x.score, 100_000),
    total: clampInt(x.total, 100_000),
    percent: clampPercent(x.percent),
    locale: sanitizeLocale(x.locale),
  };
}

export function decodeReplay(segment: string): ReplayPayload | null {
  const x = unpack(segment);
  if (!isReplayPayload(x)) return null;
  return {
    symbol: sanitizeText(x.symbol, 16),
    interval: sanitizeText(x.interval, 8),
    correct: clampInt(x.correct, 100_000),
    total: clampInt(x.total, 100_000),
    accuracyBps: clampInt(x.accuracyBps, 20_000),
    bestStreak: clampInt(x.bestStreak, 100_000),
    currentStreak: clampInt(x.currentStreak, 100_000),
    locale: sanitizeLocale(x.locale),
  };
}

export function decodeStreak(segment: string): StreakPayload | null {
  const x = unpack(segment);
  if (!isStreakPayload(x)) return null;
  return {
    currentStreak: clampInt(x.currentStreak, 100_000),
    longestStreak: clampInt(x.longestStreak, 100_000),
    locale: sanitizeLocale(x.locale),
  };
}

/** 推断 path 段属于哪种 share 类型；非法返回 null。 */
export function detectKind(segment: string): ShareKind | null {
  // 同一个 segment 可能能通过多种 guard，必须用「先尝试再返回第一个匹配」的顺序
  // 但因为字段完全不同，三选一足够：
  if (decodeQuiz(segment)) return "quiz";
  if (decodeReplay(segment)) return "replay";
  if (decodeStreak(segment)) return "streak";
  return null;
}

/** 构造可分享的 URL path 段（不含域名）。 */
export function buildSharePath(kind: ShareKind, payload: Payload): string {
  switch (kind) {
    case "quiz":
      return `/share/quiz/${encodeQuiz(payload as QuizPayload)}`;
    case "replay":
      return `/share/replay/${encodeReplay(payload as ReplayPayload)}`;
    case "streak":
      return `/share/streak/${encodeStreak(payload as StreakPayload)}`;
  }
}
