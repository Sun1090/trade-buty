// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { StudyPlan } from "./study-plan";

const dict = { generate: "生成学习计划", generating: "生成中…", title: "AI 学习计划" };

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

  it("falls back to a retry message on non-2xx responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(
      <StudyPlan
        doneChapters={[]}
        wrongChapters={[]}
        currentChapter="spot"
        dict={dict}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "生成学习计划" }));
    expect(
      await screen.findByText("暂时无法生成学习计划，请稍后重试。"),
    ).toBeInTheDocument();
  });

  it("falls back to a retry message when the request throws", async () => {
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
    expect(
      await screen.findByText("暂时无法生成学习计划，请稍后重试。"),
    ).toBeInTheDocument();
  });
});
