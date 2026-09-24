/**
 * 「关于你的数据，服务端数据库里可能存在哪些内容」的唯一清单。
 *
 * FAQ 那句「服务器上可能存在 N 类内容：…」以前是手数的：数到「三类」就收尾，而登录后的
 * AI 对话正文（`src/app/api/ai/conversations/route.ts` 拿不到账户就 401，写进去时带
 * `user_id`，表是 `supabase/migrations/0002_ai.sql` 的 `ai_conversations`）明明是第四类——
 * 同一份隐私政策的删除清单里就点名了「AI 对话记录」。两页各说各的数，谁都没错在自己的
 * 那份里，读者却拿不到一份完整的清单。
 *
 * 现在类数与被点名的内容由这张表一次决定：多一类东西就在这里加一行，FAQ 的「N 类」与
 * 那份枚举一起变，写不下对不上就是门禁红。
 *
 * 只管**写入数据库**的那几类：页面崩溃诊断走短期服务端日志、从不入库（`/api/error-reports`），
 * 由 FAQ 与隐私页各自那句日志声明守着，不在这张表里。
 */
export interface ServerDataKind {
  /** FAQ 枚举里点名的那一行（zh） */
  zh: string;
  /** FAQ 枚举里点名的那一行（en） */
  en: string;
  /** 隐私页必须就地出现的中文关键词——清单在两页必须是同一份 */
  privacyZh: string;
  /** 隐私页必须就地出现的英文关键词 */
  privacyEn: string;
  /**
   * 这一类名下实际写入的库表（表名取自 `src/lib/supabase/schema.ts`）。
   * 门禁拿它对着 schema 清点：新增一张带 `user_id` 的表却没落进任何一类，
   * FAQ 那个「N 类」就又变成手数了——这正是这一轮修掉的病。
   */
  covers: string[];
}

export const SERVER_DATA_KINDS: ServerDataKind[] = [
  {
    zh: "登录邮箱（Supabase Auth）",
    en: "your login email (Supabase Auth)",
    privacyZh: "Supabase Auth",
    privacyEn: "Supabase Auth",
    // 邮箱存在 Supabase Auth 自己那里，不是本站 schema 里的表
    covers: [],
  },
  {
    zh: "你选择同步的学习进度（Supabase Postgres，受 RLS 行级安全保护）",
    en: "the learning progress you choose to sync (Supabase Postgres, RLS-protected)",
    privacyZh: "学习进度",
    privacyEn: "learning progress",
    covers: [
      "progress",
      "wrongbook",
      "quiz_scores",
      "replay_history",
      "replay_best",
      "user_settings",
    ],
  },
  {
    zh: "登录后保存的 AI 对话正文（你的提问与那条回答全文）",
    en: "the AI conversation text saved once you are logged in (your question and the full answer)",
    privacyZh: "对话",
    privacyEn: "conversation",
    covers: ["ai_conversations"],
  },
  {
    zh: "AI 回答评分与引用点击产生的记录（未登录时是匿名行，登录后会带上你的账户标识，两类都不含邮箱与设备标识）",
    en:
      "the rows created when you rate an AI answer or open one of its citations — anonymous while you are logged out, " +
      "saved with your account identifier once you are logged in, and never with your email address or a device identifier",
    privacyZh: "评分",
    privacyEn: "rating",
    covers: ["ai_feedback", "ai_citation_clicks"],
  },
];

/** 中文枚举：「A、B、C，以及 D」——最后一项前用「以及」，与两页原有的读法一致 */
export function joinKindsZh(kinds: ServerDataKind[] = SERVER_DATA_KINDS): string {
  const body = kinds.map((k) => k.zh);
  if (body.length <= 1) return body[0] ?? "";
  return `${body.slice(0, -1).join("、")}，以及${body[body.length - 1]}`;
}

/** 英文枚举：「A, B, C, and D」 */
export function joinKindsEn(kinds: ServerDataKind[] = SERVER_DATA_KINDS): string {
  const body = kinds.map((k) => k.en);
  if (body.length <= 1) return body[0] ?? "";
  return `${body.slice(0, -1).join(", ")}, and ${body[body.length - 1]}`;
}

/** 被存下来的类数——文案里那个「N 类 / N kinds」必须由它代入 */
export const SERVER_DATA_KIND_COUNT = SERVER_DATA_KINDS.length;
