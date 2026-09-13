// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { CodeCopy } from "./code-copy";

function stubClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", {
    value,
    configurable: true,
    writable: true,
  });
}

function renderWithPre(codeText: string, lang?: string) {
  return render(
    <article>
      <pre>
        <code className={lang ? `language-${lang}` : undefined}>{codeText}</code>
      </pre>
      <CodeCopy containerSelector="article" copiedLabel="已复制" copyLabel="复制" />
    </article>,
  );
}

function preButton(container: HTMLElement) {
  return container.querySelector("pre > button");
}

describe("CodeCopy", () => {
  beforeEach(() => {
    cleanup();
    // 默认兜底返回 false，避免跨用例残留
    document.execCommand = vi.fn(() => false) as unknown as typeof document.execCommand;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("渲染（不可见组件）", () => {
    const { container } = render(
      <CodeCopy containerSelector="article" copiedLabel="已复制" copyLabel="复制" />
    );
    expect(container).toBeTruthy();
  });

  it("语言标签和复制按钮使用主题可读颜色", async () => {
    const { container } = renderWithPre("const ok = true;", "typescript");

    await waitFor(() => {
      expect(container.querySelector("pre > span")?.textContent).toBe("typescript");
      expect(preButton(container)?.textContent).toBe("复制");
    });

    const tag = container.querySelector("pre > span");
    const button = preButton(container);
    expect(tag?.className).toContain("text-muted");
    expect(button?.className).toContain("text-muted");
    expect(button?.className).not.toContain("text-white/60");
  });

  it("点击复制按钮把代码块文本写入剪贴板", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });
    const { container } = renderWithPre("const ok = true;", "typescript");

    await waitFor(() => expect(preButton(container)).toBeTruthy());
    fireEvent.click(preButton(container)!);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("const ok = true;"));
    await waitFor(() => expect(preButton(container)?.textContent).toBe("已复制"));
  });

  it("异步剪贴板不可用时退回 execCommand 并显示成功", async () => {
    stubClipboard(undefined);
    document.execCommand = vi.fn(() => true) as unknown as typeof document.execCommand;
    const { container } = renderWithPre("let x = 1;");

    await waitFor(() => expect(preButton(container)).toBeTruthy());
    fireEvent.click(preButton(container)!);

    await waitFor(() => expect(document.execCommand).toHaveBeenCalledWith("copy"));
    await waitFor(() => expect(preButton(container)?.textContent).toBe("已复制"));
  });

  it("两条路径都失败时显示 ✕，不伪装成功", async () => {
    stubClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) });
    document.execCommand = vi.fn(() => false) as unknown as typeof document.execCommand;
    const { container } = renderWithPre("let y = 2;");

    await waitFor(() => expect(preButton(container)).toBeTruthy());
    fireEvent.click(preButton(container)!);

    await waitFor(() => expect(preButton(container)?.textContent).toBe("✕"));
  });

  it("动态插入的代码块也会挂上复制按钮（MutationObserver）", async () => {
    stubClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    const { container } = render(
      <article>
        <CodeCopy containerSelector="article" copiedLabel="已复制" copyLabel="复制" />
      </article>,
    );

    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.className = "language-json";
    code.textContent = "{}";
    pre.appendChild(code);
    container.querySelector("article")!.appendChild(pre);

    await waitFor(() => expect(preButton(container)).toBeTruthy());
    expect(container.querySelector("pre > span")?.textContent).toBe("json");
  });

  it("无 language- 类的代码块不生成语言标签，但仍可复制", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });
    const { container } = renderWithPre("plain text");

    await waitFor(() => expect(preButton(container)).toBeTruthy());
    expect(container.querySelector("pre > span")).toBeNull();

    fireEvent.click(preButton(container)!);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("plain text"));
  });

  it("容器选择器匹配不到元素时静默跳过", () => {
    const { container } = render(
      <CodeCopy containerSelector=".does-not-exist" copiedLabel="已复制" copyLabel="复制" />
    );
    expect(container.querySelector("pre")).toBeNull();
  });
});
