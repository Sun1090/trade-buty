// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { downloadCanvasAsPng, canWebShare, canShareFile, webShare, shareCanvasAsPng } from "./download";

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

  it("非浏览器环境（无 document）时明确抛错而不是静默失败", async () => {
    vi.stubGlobal("document", undefined);
    await expect(downloadCanvasAsPng(fakeCanvas(new Blob(["x"])), "x.png")).rejects.toThrow(
      /only works in the browser/,
    );
  });

  it("延迟回收 ObjectURL，避免下载被提前打断", async () => {
    vi.useFakeTimers();
    try {
      const revokeObjectURL = vi.fn();
      vi.stubGlobal("URL", { createObjectURL: () => "blob:later", revokeObjectURL });
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

      await downloadCanvasAsPng(fakeCanvas(new Blob(["x"])), "x.png");
      expect(revokeObjectURL).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1000);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:later");
    } finally {
      vi.useRealTimers();
    }
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

describe("canShareFile", () => {
  it("要问过 canShare：有 share 但没 canShare 的浏览器算不能分享文件", () => {
    vi.stubGlobal("navigator", { share: vi.fn() });
    expect(canShareFile(new File(["x"], "c.png", { type: "image/png" }))).toBe(false);
  });

  it("canShare 回 false（桌面 Chrome 就是这一类）→ 不能", () => {
    vi.stubGlobal("navigator", { share: vi.fn(), canShare: () => false });
    expect(canShareFile(new File(["x"], "c.png", { type: "image/png" }))).toBe(false);
  });

  it("canShare 回 true 且带上这个文件", () => {
    const canShare = vi.fn(() => true);
    vi.stubGlobal("navigator", { share: vi.fn(), canShare });
    const file = new File(["x"], "c.png", { type: "image/png" });
    expect(canShareFile(file)).toBe(true);
    expect(canShare).toHaveBeenCalledWith({ files: [file] });
  });
});

describe("webShare", () => {
  it("不支持时返回 unsupported 且不抛错", async () => {
    vi.stubGlobal("navigator", {});
    await expect(webShare({ title: "t" })).resolves.toBe("unsupported");
  });

  it("用户取消（AbortError）单独成态，不与失败混为一谈", async () => {
    vi.stubGlobal("navigator", {
      share: vi.fn(async () => {
        throw Object.assign(new Error("cancel"), { name: "AbortError" });
      }),
    });
    await expect(webShare({ title: "t" })).resolves.toBe("cancelled");
  });

  it("非取消的失败返回 failed", async () => {
    vi.stubGlobal("navigator", {
      share: vi.fn(async () => {
        throw Object.assign(new Error("nope"), { name: "NotAllowedError" });
      }),
    });
    await expect(webShare({ title: "t" })).resolves.toBe("failed");
  });

  it("分享成功返回 shared 并带上载荷", async () => {
    const share = vi.fn(async () => {});
    vi.stubGlobal("navigator", { share });
    await expect(webShare({ title: "t", url: "https://x" })).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: "t", url: "https://x" });
  });
});

describe("shareCanvasAsPng", () => {
  function stubUrlAndClick() {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.stubGlobal("URL", { createObjectURL: () => "blob:share", revokeObjectURL: vi.fn() });
    return clickSpy;
  }

  it("面板接受文件 → 分享图片，不产生下载", async () => {
    const clickSpy = stubUrlAndClick();
    const share = vi.fn<(payload: { files: File[]; title?: string }) => Promise<void>>(async () => {});
    vi.stubGlobal("navigator", { share, canShare: () => true });

    const outcome = await shareCanvasAsPng(fakeCanvas(new Blob(["x"], { type: "image/png" })), "card.png", { title: "卡面" });

    expect(outcome).toBe("shared");
    expect(share).toHaveBeenCalledTimes(1);
    const payload = share.mock.calls[0][0];
    expect(payload.title).toBe("卡面");
    expect(payload.files[0].name).toBe("card.png");
    expect(payload.files[0].type).toBe("image/png");
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("平台不收文件（桌面/微信内置）→ 退回下载并如实报 downloaded", async () => {
    const clickSpy = stubUrlAndClick();
    vi.stubGlobal("navigator", { share: vi.fn(), canShare: () => false });

    const outcome = await shareCanvasAsPng(fakeCanvas(new Blob(["x"])), "card.png");

    expect(outcome).toBe("downloaded");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("用户取消面板 → cancelled，绝不擅自补一次下载", async () => {
    const clickSpy = stubUrlAndClick();
    vi.stubGlobal("navigator", {
      share: vi.fn(async () => {
        throw Object.assign(new Error("cancel"), { name: "AbortError" });
      }),
      canShare: () => true,
    });

    await expect(shareCanvasAsPng(fakeCanvas(new Blob(["x"])), "card.png")).resolves.toBe("cancelled");
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("面板报错（非取消）→ 才退回下载", async () => {
    const clickSpy = stubUrlAndClick();
    vi.stubGlobal("navigator", {
      share: vi.fn(async () => {
        throw Object.assign(new Error("nope"), { name: "NotAllowedError" });
      }),
      canShare: () => true,
    });

    await expect(shareCanvasAsPng(fakeCanvas(new Blob(["x"])), "card.png")).resolves.toBe("downloaded");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("完全没有分享面板 → 下载", async () => {
    const clickSpy = stubUrlAndClick();
    vi.stubGlobal("navigator", {});

    await expect(shareCanvasAsPng(fakeCanvas(new Blob(["x"])), "card.png")).resolves.toBe("downloaded");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("画布导不出 blob → failed，既不分享也不下载", async () => {
    const clickSpy = stubUrlAndClick();
    vi.stubGlobal("navigator", { share: vi.fn(), canShare: () => true });

    await expect(shareCanvasAsPng(fakeCanvas(null), "card.png")).resolves.toBe("failed");
    expect(clickSpy).not.toHaveBeenCalled();
  });
});
