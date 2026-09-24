/** 举报按钮的三态：只有 `sent` 才可以对用户说「已举报」 */
export type ReportStatus = "sending" | "sent" | "failed";

/**
 * AI 反馈上报：`已举报` 这句话只有服务端点头才算数，所以这里把响应读到底，
 * 返回值是唯一事实来源——调用方不得在 `fetch` 之前就把状态写成「已」。
 * （`/api/ai/feedback` 匿名可写，429/413/400/500 都会回非 2xx。）
 */
export async function sendAiFeedback(payload: {
  rating: "helpful" | "unhelpful";
  question: string;
  answer: string;
}): Promise<boolean> {
  try {
    const res = await fetch("/api/ai/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
