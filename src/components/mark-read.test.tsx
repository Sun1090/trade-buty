// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MarkRead } from "./mark-read";

vi.mock("@/lib/progress", () => ({
  markRead: vi.fn(),
}));

describe("MarkRead", () => {
  it("渲染（不可见组件）", () => {
    const { container } = render(
      <MarkRead chapterNum="spot" docSlug="doc-a" />
    );
    expect(container).toBeTruthy();
  });
});
