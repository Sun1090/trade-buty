// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { CodeCopy } from "./code-copy";

describe("CodeCopy", () => {
  it("渲染（不可见组件）", () => {
    const { container } = render(
      <CodeCopy containerSelector="article" copiedLabel="已复制" copyLabel="复制" />
    );
    expect(container).toBeTruthy();
  });

  it("语言标签和复制按钮使用主题可读颜色", async () => {
    const { container } = render(
      <article>
        <pre><code className="language-typescript">const ok = true;</code></pre>
        <CodeCopy containerSelector="article" copiedLabel="已复制" copyLabel="复制" />
      </article>,
    );

    await waitFor(() => {
      expect(container.querySelector("pre > span")?.textContent).toBe("typescript");
      expect(container.querySelector("pre > button")?.textContent).toBe("复制");
    });

    const tag = container.querySelector("pre > span");
    const button = container.querySelector("pre > button");
    expect(tag?.className).toContain("text-muted");
    expect(button?.className).toContain("text-muted");
    expect(button?.className).not.toContain("text-white/60");
  });
});
