// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import { DailyTip } from "./daily-tip";
import { getSeedTip, TIPS_EN, TIPS_ZH } from "@/lib/tips";

/** 从渲染出的 HTML 里取出卡片正文（服务端会把引号等转义） */
function tipTextOf(html: string): string {
  const raw = /leading-relaxed">([^<]*)</.exec(html)?.[1] ?? "";
  return raw
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DailyTip", () => {
  it("服务端渲染是确定值：同一 locale 两次渲染同一条", () => {
    // 卡片挂在静态页上，服务端 HTML 在构建时固化；渲染期取随机会让水合文本对不上
    expect(renderToString(<DailyTip locale="zh" nextTipLabel="换一条心得" />)).toBe(
      renderToString(<DailyTip locale="zh" nextTipLabel="换一条心得" />),
    );
    expect(tipTextOf(renderToString(<DailyTip locale="en" nextTipLabel="Next tip" />))).toBe(getSeedTip("en"));
  });

  it("渲染期不碰 Math.random：随机只发生在挂载与点击之后", () => {
    const spy = vi.spyOn(Math, "random");
    renderToString(<DailyTip locale="zh" nextTipLabel="换一条心得" />);
    expect(spy).not.toHaveBeenCalled();
  });

  it("挂载后换成池中随机一条", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.95);
    render(<DailyTip locale="zh" nextTipLabel="换一条心得" />);
    // 0.95 × 10 → 第 10 条
    expect(screen.getByText(TIPS_ZH[TIPS_ZH.length - 1])).toBeInTheDocument();
  });

  it("点击「换一条心得」：从当前这条换成池里的另一条", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<DailyTip locale="zh" nextTipLabel="换一条心得" />);
    expect(screen.getByText(TIPS_ZH[0])).toBeInTheDocument();

    // 可访问名称吃传入文案：中文界面里这个按钮就该叫「换一条心得」
    fireEvent.click(screen.getByRole("button", { name: "换一条心得" }));
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    fireEvent.click(screen.getByRole("button", { name: "换一条心得" }));
    expect(screen.getByText(TIPS_ZH[Math.floor(0.5 * TIPS_ZH.length)])).toBeInTheDocument();
  });

  it("英文 locale 只用英文池", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.95);
    render(<DailyTip locale="en" nextTipLabel="Next tip" />);
    const text = screen.getByText(TIPS_EN[TIPS_EN.length - 1]).textContent;
    expect(TIPS_EN).toContain(text);
    expect(TIPS_ZH).not.toContain(text);
  });
});
