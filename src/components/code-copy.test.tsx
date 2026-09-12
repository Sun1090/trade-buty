// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CodeCopy } from "./code-copy";

describe("CodeCopy", () => {
  it("渲染（不可见组件）", () => {
    const { container } = render(
      <CodeCopy containerSelector="article" copiedLabel="已复制" copyLabel="复制" />
    );
    expect(container).toBeTruthy();
  });
});
