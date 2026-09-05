// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const { LessonAskAi } = await import("./lesson-ask-ai");
const { isAiGloballyDisabled } = await import("@/lib/ai-toggle");

afterEach(cleanup);

describe("LessonAskAi（R3.1/R3.9/R3.11）", () => {
  it("渲染链接：href 携带 q/ctx/ct 三个参数", () => {
    const href = "/zh/ai?q=%E5%B8%AE%E6%88%91%E6%80%BB%E7%BB%93&ctx=spot&ct=%E7%8E%B0%E8%B4%A7";
    render(<LessonAskAi href={href} label="问 AI：梳理本课要点" chapter="spot" />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe(href);
    expect(link.textContent).toContain("问 AI：梳理本课要点");
  });

  it("enabled=false 时不渲染（无 key 环境隐藏入口）", () => {
    const { container } = render(
      <LessonAskAi href="/zh/ai" label="问 AI" chapter="spot" enabled={false} />
    );
    expect(container.textContent).toBe("");
  });

  it("点击触发埋点", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    render(<LessonAskAi href="/zh/ai" label="问 AI" chapter="spot" />);
    fireEvent.click(screen.getByRole("link"));
    expect(spy).toHaveBeenCalledWith("[ai-track]", "lesson-ask-ai", { chapter: "spot" });
    spy.mockRestore();
  });
});

describe("ai-toggle（R3.9/R3.10）", () => {
  it("默认开启", () => {
    vi.stubEnv("NEXT_PUBLIC_AI_ENABLED", "");
    expect(isAiGloballyDisabled()).toBe(false);
    vi.unstubAllEnvs();
  });

  it("NEXT_PUBLIC_AI_ENABLED=false 时一键全关", () => {
    vi.stubEnv("NEXT_PUBLIC_AI_ENABLED", "false");
    expect(isAiGloballyDisabled()).toBe(true);
    vi.unstubAllEnvs();
  });
});
