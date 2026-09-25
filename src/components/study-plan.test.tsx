// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { StudyPlan } from "./study-plan";

const dict = {
  generate: "生成学习计划",
  generating: "生成中…",
  title: "AI 学习计划",
  error: "暂时无法生成学习计划，请稍后重试。",
  loginRequired: "登录后可生成学习计划",
};
const enDict = {
  generate: "Generate plan",
  generating: "Generating...",
  title: "AI Study Plan",
  error: "Plan generation is unavailable right now",
  loginRequired: "Log in to generate a study plan",
};

type Deferred = { resolve: (value: unknown) => void };
let pending: Deferred;

function deferredFetch() {
  return vi.fn(
    () =>
      new Promise((resolve) => {
        pending = { resolve };
      }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("StudyPlan", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the title and the generate button", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(
      <StudyPlan
        doneChapters={[]}
        wrongChapters={[]}
        currentChapter="getting-started"
        dict={dict}
      />,
    );
    expect(screen.getByText("AI 学习计划")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成学习计划" })).toBeEnabled();
  });

  it("shows the loading label while the request is in flight", async () => {
    vi.stubGlobal("fetch", deferredFetch());
    render(
      <StudyPlan
        doneChapters={[]}
        wrongChapters={[]}
        currentChapter="getting-started"
        dict={dict}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "生成学习计划" }));
    const loading = screen.getByRole("button", { name: "生成中…" });
    expect(loading).toBeDisabled();

    await act(async () => {
      pending.resolve({ ok: true, json: async () => ({ plan: "今天先学第 1 章" }) });
    });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("posts the learning context and renders the returned plan", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ plan: "复习仓位管理" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <StudyPlan
        doneChapters={["getting-started"]}
        wrongChapters={["risk"]}
        currentChapter="spot"
        dict={dict}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "生成学习计划" }));
    expect(await screen.findByText("复习仓位管理")).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/plan",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doneChapters: ["getting-started"],
          wrongChapters: ["risk"],
          currentChapter: "spot",
        }),
      }),
    );
  });

  // 屏幕上那颗按钮写的是「生成学习计划」，没有一颗叫「重试」——R16.54 修的是「失败把按钮
  // 一起吞掉」，标题原本也就跟着把那颗按钮叫成了重试按钮。
  it("非 2xx 时说「稍后重试」，并且「生成学习计划」那颗按钮还在（R16.54：旧写法把失败写进 plan，按钮一起没了）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    render(
      <StudyPlan
        doneChapters={[]}
        wrongChapters={[]}
        currentChapter="spot"
        dict={dict}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "生成学习计划" }));
    expect(await screen.findByText(dict.error)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成学习计划" })).toBeEnabled();
  });

  it("请求抛异常时同样只报失败，不吞掉「生成学习计划」那颗按钮", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(
      <StudyPlan
        doneChapters={[]}
        wrongChapters={[]}
        currentChapter="spot"
        dict={dict}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "生成学习计划" }));
    expect(await screen.findByText(dict.error)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成学习计划" })).toBeEnabled();
  });

  it("未登录点生成说的是「要登录」，不是「等一会儿再试」", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    render(
      <StudyPlan
        doneChapters={[]}
        wrongChapters={[]}
        currentChapter="spot"
        dict={dict}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "生成学习计划" }));
    expect(await screen.findByText(dict.loginRequired)).toBeInTheDocument();
    expect(screen.queryByText(dict.error)).not.toBeInTheDocument();
  });

  it("英文界面拿到的是字典里的英文，不是组件里写死的中文", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    render(
      <StudyPlan
        doneChapters={[]}
        wrongChapters={[]}
        currentChapter="spot"
        dict={enDict}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Generate plan" }));
    expect(await screen.findByText(enDict.loginRequired)).toBeInTheDocument();
    expect(screen.queryByText(/暂|请稍后|登录后可生成/)).not.toBeInTheDocument();
  });
});
