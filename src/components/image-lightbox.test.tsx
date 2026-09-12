// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ImageLightbox } from "./image-lightbox";

afterEach(() => {
  document.querySelectorAll("article[data-lightbox-test]").forEach((element) => element.remove());
});

describe("ImageLightbox", () => {
  it("渲染（不可见组件）", () => {
    const { container } = render(
      <ImageLightbox containerSelector="article" closeLabel="关闭" />
    );
    expect(container).toBeTruthy();
  });

  it("打开后聚焦关闭按钮，Escape 关闭对话框", async () => {
    const article = document.createElement("article");
    article.dataset.lightboxTest = "";
    article.innerHTML = '<img src="/chart.png" alt="走势图" />';
    document.body.appendChild(article);
    render(<ImageLightbox containerSelector="article" closeLabel="关闭" />);

    fireEvent.click(article.querySelector("img")!);
    const close = screen.getByRole("button", { name: "关闭" });
    await waitFor(() => expect(close).toHaveFocus());
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
