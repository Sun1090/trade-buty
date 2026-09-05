// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SyncSummaryToast } from "./sync-summary-toast";
import type { MergeSummary } from "@/lib/sync-layer";

// jsdom 30 opaque origin → sessionStorage 不可用；挂 mock
const memStore = new Map<string, string>();
Object.defineProperty(globalThis, "sessionStorage", {
  value: {
    getItem: (k: string) => memStore.get(k) ?? null,
    setItem: (k: string, v: string) => memStore.set(k, v),
    removeItem: (k: string) => memStore.delete(k),
    clear: () => memStore.clear(),
  },
  writable: true,
});

beforeEach(() => {
  memStore.clear();
  // 默认路径 /zh/
  Object.defineProperty(window, "location", {
    value: { pathname: "/zh/" },
    writable: true,
  });
});

function emit(summary: MergeSummary) {
  act(() => {
    window.dispatchEvent(new CustomEvent("tb-merge-summary", { detail: summary }));
  });
}

describe("SyncSummaryToast", () => {
  it("默认不渲染", () => {
    const { container } = render(<SyncSummaryToast />);
    expect(container.firstChild).toBeNull();
  });

  it("hasAny=false 时收到事件也不渲染", () => {
    render(<SyncSummaryToast />);
    emit({
      newProgress: 0,
      newWrong: 0,
      quizImprovements: 0,
      newReplays: 0,
      hasAny: false,
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("hasAny=true 时渲染并显示中文标题", () => {
    render(<SyncSummaryToast />);
    emit({
      newProgress: 3,
      newWrong: 2,
      quizImprovements: 1,
      newReplays: 0,
      hasAny: true,
    });
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(status.textContent).toContain("已为你同步云端进度");
    expect(status.textContent).toContain("新增 3 篇已读");
    expect(status.textContent).toContain("新增 2 条错题");
    expect(status.textContent).toContain("1 个章节测验分数提升");
  });

  it("英文路径用英文字典", () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/en/" },
      writable: true,
    });
    render(<SyncSummaryToast />);
    emit({
      newProgress: 5,
      newWrong: 0,
      quizImprovements: 0,
      newReplays: 2,
      hasAny: true,
    });
    expect(screen.getByRole("status").textContent).toContain("Synced your cloud progress");
    expect(screen.getByRole("status").textContent).toContain("5 new lessons marked read");
    expect(screen.getByRole("status").textContent).toContain("2 replay records");
  });

  it("点关闭按钮立即消失", () => {
    render(<SyncSummaryToast />);
    emit({ newProgress: 1, newWrong: 0, quizImprovements: 0, newReplays: 0, hasAny: true });
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "dismiss" }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("点底部确认按钮也关闭", () => {
    render(<SyncSummaryToast />);
    emit({ newProgress: 1, newWrong: 0, quizImprovements: 0, newReplays: 0, hasAny: true });
    expect(screen.getByRole("status")).toBeInTheDocument();
    // 找含 "好的" 或 "Got it" 的按钮
    const btns = screen.getAllByRole("button");
    const dismissBtn = btns.find((b) => /好的|Got it/.test(b.textContent ?? ""));
    expect(dismissBtn).toBeDefined();
    fireEvent.click(dismissBtn!);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("sessionStorage 已标记时同一会话不重复弹", () => {
    memStore.set("tb-merge-summary-shown", "1");
    render(<SyncSummaryToast />);
    emit({ newProgress: 1, newWrong: 0, quizImprovements: 0, newReplays: 0, hasAny: true });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("只渲染有数据的行（newReplays=0 时不显示）", () => {
    render(<SyncSummaryToast />);
    emit({ newProgress: 1, newWrong: 0, quizImprovements: 0, newReplays: 0, hasAny: true });
    const text = screen.getByRole("status").textContent ?? "";
    expect(text).toContain("新增 1 篇已读");
    expect(text).not.toContain("回放战绩");
  });
});
