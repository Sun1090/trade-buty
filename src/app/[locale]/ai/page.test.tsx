// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { totalChapterCount } from "@/lib/content";

// AiChat 是客户端组件：这里只关心服务端把什么 dict 交给它。
vi.mock("@/components/ai-chat", () => ({
  AiChat: ({ dict }: { dict: { subtitle: string } }) => <p data-testid="subtitle">{dict.subtitle}</p>,
}));
vi.mock("@/lib/ai-toggle", () => ({ aiEnabledForPage: () => true }));

import AiPage, { generateMetadata } from "./page";

/** Next 生成的 PageProps 还要求 searchParams，测试里统一造一份 */
function props(locale: "zh" | "en"): PageProps<"/[locale]/ai"> {
  return {
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve({}),
  };
}

/**
 * `{chapters}` 是服务端代入的占位符。AI 页把整个 `t.ai` 交给客户端组件，
 * 所以这一处最容易漏——漏了用户看到的就是「基于 {chapters} 篇章知识库」。
 */
describe("/[locale]/ai 的篇章数", () => {
  it("副标题与元描述里的篇章数都是知识库的真实数", async () => {
    const n = totalChapterCount();
    expect(n, "篇章数必须扫得出来").toBeGreaterThan(10);

    const meta = await generateMetadata(props("zh"));
    expect(String(meta.description)).toContain(`${n} 篇章`);
    expect(String(meta.description)).not.toContain("{chapters}");

    render((await AiPage(props("zh"))) as ReactElement);
    const subtitle = screen.getByTestId("subtitle").textContent ?? "";
    expect(subtitle).toContain(`基于 ${n} 篇章知识库`);
    expect(subtitle).not.toContain("{chapters}");
  });

  it("en 同样代入（占位符漏进英文界面时没人会去点进页面看）", async () => {
    const n = totalChapterCount();
    render((await AiPage(props("en"))) as ReactElement);
    const subtitle = screen.getByTestId("subtitle").textContent ?? "";
    expect(subtitle).toContain(`${n} chapters of knowledge`);
    expect(subtitle).not.toContain("{chapters}");
  });
});
