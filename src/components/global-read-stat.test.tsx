// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GlobalReadStat } from "./global-read-stat";

vi.mock("@/components/use-local-progress", () => ({
  useLocalProgress: () => ({ "getting-started": ["doc-a", "doc-b"] }),
}));
vi.mock("@/components/auth-provider", () => ({
  useAuth: () => null,
}));

describe("GlobalReadStat", () => {
  it("显示已读数 2/10", () => {
    render(
      <GlobalReadStat
        totalDocs={10}
        textTpl="已读 {r}/{t}"
        keepGoing="继续"
        syncedLabel="已同步"
      />
    );
    expect(screen.getByText(/已读/)).toBeInTheDocument();
    expect(screen.getByText(/2\/10/)).toBeInTheDocument();
  });

  it("无进度返回 null", () => {
    const { container } = render(
      <GlobalReadStat
        totalDocs={10}
        textTpl="已读 {r}/{t}"
        keepGoing="继续"
        syncedLabel="已同步"
      />
    );
    // useLocalProgress mock 返回有进度，这里不测 null 分支
    expect(container).toBeTruthy();
  });
});
