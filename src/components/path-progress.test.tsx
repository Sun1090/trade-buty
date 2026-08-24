// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { PathProgress } from "./path-progress";

vi.mock("@/components/use-local-progress", () => ({
  useLocalProgress: () => ({ "spot": ["a", "b", "c"] }),
}));

describe("PathProgress", () => {
  it("显示已读数 3/5", () => {
    const { container } = render(
      <PathProgress chapterSlug="spot" docCount={5} />
    );
    expect(container.textContent).toContain("3/5");
  });

  it("完成全章显示勾标", () => {
    const { container } = render(
      <PathProgress chapterSlug="spot" docCount={3} />
    );
    expect(container.textContent).toContain("✓");
  });

  it("无进度返回 null", () => {
    const { container } = render(
      <PathProgress chapterSlug="empty" docCount={5} />
    );
    expect(container.firstChild).toBeNull();
  });
});
