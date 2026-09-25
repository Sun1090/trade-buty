/**
 * R16.203：一段聊得足够久的对话，会在某一轮之后**永远问不动**。
 *
 * `parseChatBody` 对**每一条**消息都套 `MAX_CHAT_CONTENT_CHARS`（`chat-input.ts:54`），
 * 超了整包判 null → 路由 400 `Invalid payload`；而「继续生成」是往同一条 assistant
 * 消息上追加（`ai-chat.tsx` 的 `continueGeneration`），`send` 又把整个 `messages`
 * 原文带上（`:275`）。于是一条被续写几轮的回答越过 8000 字之后，这个人每问一句都是
 * 400，屏幕上留下的还是那句英文开发串（R16.204）。
 *
 * 这里先把事实钉住：一条超过 8000 字的 assistant 消息，配上任何一句新提问，
 * 就是 null。它跟「谁的问题太长了」无关——提问输入框本来就限 500 字。
 */
import { describe, expect, it } from "vitest";
import {
  MAX_CHAT_CONTENT_CHARS,
  parseChatBody,
} from "@/lib/ai/chat-input";

describe("一段续写久了的对话会被自己的历史判死（R16.203）", () => {
  it("单条回答超过上限，整包就是畸形载荷", () => {
    const longAnswer = "止".repeat(MAX_CHAT_CONTENT_CHARS + 1);
    const body = {
      messages: [
        { role: "user", content: "什么是止损？" },
        { role: "assistant", content: longAnswer },
        { role: "user", content: "那移动止损呢？" },
      ],
      locale: "zh",
    };
    expect(parseChatBody(body)).toBeNull();

    // 同一条回答只要不超上限，同样的三句话就过得去——被拒的不是格式，是这一条的长度
    const okBody = {
      ...body,
      messages: body.messages.map((m) =>
        m.role === "assistant" ? { ...m, content: m.content.slice(0, MAX_CHAT_CONTENT_CHARS) } : m,
      ),
    };
    expect(parseChatBody(okBody)).not.toBeNull();
  });

  it("上限是按字符算的，500 字的提问永远撞不到它——只有回答会", () => {
    // 提问侧：`<input maxLength={500}>`，所以人自己打不出超过上限的内容
    expect(MAX_CHAT_CONTENT_CHARS).toBeGreaterThan(500);
    // 回答侧：一次续写的量级（这里按 2500 字算）远不到上限，是「继续生成」
    // 反复追加把它一段一段推过去的——到第四段才跨过 8000。
    const base = "盈".repeat(2500);
    for (const rounds of [1, 2, 3, 4]) {
      const content = base.repeat(rounds);
      const verdict = parseChatBody({
        messages: [
          { role: "user", content: "讲讲盈亏比" },
          { role: "assistant", content },
        ],
        locale: "zh",
      });
      if (rounds === 4) expect(verdict, `${rounds} 段追加（${content.length} 字）仍被接受？`).toBeNull();
      else expect(verdict, `${rounds} 段追加（${content.length} 字）本该过得去`).not.toBeNull();
    }
  });
});
