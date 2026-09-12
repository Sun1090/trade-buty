// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { downloadCanvasAsPng, canWebShare, webShare } from "./download";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function fakeCanvas(blob: Blob | null): HTMLCanvasElement {
  return {
    toBlob: (cb: (b: Blob | null) => void) => cb(blob),
  } as unknown as HTMLCanvasElement;
}

describe("downloadCanvasAsPng", () => {
  it("把 canvas 导出为 PNG 并触发下载（含下载属性与 ObjectURL 回收）", async () => {
    const blob = new Blob(["x"], { type: "image/png" });
    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    await downloadCanvasAsPng(fakeCanvas(blob), "share-card.png");

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    // 下载用的 <a> 已从 DOM 移除，不残留
    expect(document.querySelector("a")).toBeNull();
  });

  it("toBlob 返回 null 时抛错", async () => {
    vi.stubGlobal("URL", { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() });
    await expect(downloadCanvasAsPng(fakeCanvas(null), "x.png")).rejects.toThrow(
      /toBlob returned null/,
    );
  });
});

describe("canWebShare", () => {
  it("navigator.share 为函数时返回 true", () => {
    vi.stubGlobal("navigator", { share: vi.fn() });
    expect(canWebShare()).toBe(true);
  });

  it("无 navigator.share 时返回 false", () => {
    vi.stubGlobal("navigator", {});
    expect(canWebShare()).toBe(false);
  });
});

describe("webShare", () => {
  it("不支持时返回 false 且不抛错", async () => {
    vi.stubGlobal("navigator", {});
    await expect(webShare({ title: "t" })).resolves.toBe(false);
  });

  it("用户取消（share 抛错）时静默返回 false", async () => {
    vi.stubGlobal("navigator", {
      share: vi.fn(async () => {
        throw new Error("AbortError");
      }),
    });
    await expect(webShare({ title: "t" })).resolves.toBe(false);
  });

  it("分享成功返回 true 并带上载荷", async () => {
    const share = vi.fn(async () => {});
    vi.stubGlobal("navigator", { share });
    await expect(webShare({ title: "t", url: "https://x" })).resolves.toBe(true);
    expect(share).toHaveBeenCalledWith({ title: "t", url: "https://x" });
  });
});
