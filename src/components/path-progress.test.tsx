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

  it("已读记录多于本章课数时按课数封顶：不出现 3/2 与 150%", () => {
    const { container } = render(
      <PathProgress chapterSlug="spot" docCount={2} />
    );
    expect(container.textContent).toContain("2/2");
    expect(container.textContent).not.toContain("3/2");
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
