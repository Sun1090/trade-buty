// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ImageLightbox } from "./image-lightbox";

describe("ImageLightbox", () => {
  it("渲染（不可见组件）", () => {
    const { container } = render(
      <ImageLightbox containerSelector="article" closeLabel="关闭" />
    );
    expect(container).toBeTruthy();
  });
});
