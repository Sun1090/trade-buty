// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GlobalReadStat } from "./global-read-stat";

const state = vi.hoisted(() => ({
  progress: null as Record<string, string[]> | null,
  user: null as { id: string } | null,
}));

vi.mock("@/components/use-local-progress", () => ({
  useLocalProgress: () => state.progress,
}));
vi.mock("@/components/auth-provider", () => ({
  useAuth: () => state.user,
}));

const props = {
  totalDocs: 10,
  textTpl: "已读 {r}/{t}",
  keepGoing: "继续",
  syncedLabel: "已同步",
};

beforeEach(() => {
  state.progress = null;
  state.user = null;
});

describe("GlobalReadStat", () => {
  it("汇总各章节已读数并替换模板占位符", () => {
    state.progress = {
      "getting-started": ["doc-a", "doc-b"],
      spot: ["doc-c"],
    };
    render(<GlobalReadStat {...props} />);
    expect(screen.getByText(/已读 3\/10/)).toBeInTheDocument();
    expect(screen.getByText("继续")).toBeInTheDocument();
  });

  it.each([
    ["尚未读取本地存储", null],
    ["本地进度为空", {}],
    ["章节列表均为空", { "getting-started": [], spot: [] }],
  ])("%s 时不渲染统计", (_label, progress) => {
    state.progress = progress as Record<string, string[]> | null;
    const { container } = render(<GlobalReadStat {...props} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("登录用户显示云同步标记及可访问说明", () => {
    state.progress = { spot: ["candlesticks"] };
    state.user = { id: "user-1" };
    render(<GlobalReadStat {...props} />);
    expect(screen.getByTitle("已同步")).toHaveTextContent("☁");
  });

  it("游客不显示云同步标记", () => {
    state.progress = { spot: ["candlesticks"] };
    render(<GlobalReadStat {...props} />);
    expect(screen.queryByTitle("已同步")).not.toBeInTheDocument();
  });
});
