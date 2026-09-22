import { describe, expect, it, vi, beforeEach } from "vitest";
import { runShareCardFlow } from "./share-card-flow";
import { shareCanvasAsPng } from "./download";
import { trackGrowthEvent } from "./growth-events";

vi.mock("./download", () => ({ shareCanvasAsPng: vi.fn() }));
vi.mock("./growth-events", () => ({ trackGrowthEvent: vi.fn() }));

const canvas = { toBlob: vi.fn() } as unknown as HTMLCanvasElement;

function args(over: Partial<Parameters<typeof runShareCardFlow>[0]> = {}) {
  return {
    card: "quiz" as const,
    locale: "zh" as const,
    surface: "owner" as const,
    filename: "card.png",
    title: "分享我的成绩",
    draw: vi.fn(async () => {}),
    getCanvas: () => canvas,
    ...over,
  };
}

/** 已上报的事件（按调用顺序），只取断言用到的两个字段 */
function tracked(): { name: string; outcome: string }[] {
  return vi.mocked(trackGrowthEvent).mock.calls.map(([event]) => ({
    name: event.name,
    outcome: "outcome" in event ? String(event.outcome) : "none",
  }));
}

beforeEach(() => {
  vi.mocked(trackGrowthEvent).mockClear();
  vi.mocked(shareCanvasAsPng).mockReset();
});

describe("runShareCardFlow", () => {
  it("图片进了系统面板 → 只记 share_card_shared，不再补一条下载成功", async () => {
    vi.mocked(shareCanvasAsPng).mockResolvedValue("shared");

    expect(await runShareCardFlow(args())).toBe("shared");
    expect(shareCanvasAsPng).toHaveBeenCalledWith(canvas, "card.png", { title: "分享我的成绩" });
    expect(tracked().map((e) => [e.name, e.outcome])).toEqual([
      ["share_card_download", "started"],
      ["share_card_shared", "succeeded"],
    ]);
  });

  it("面板不收文件而退回下载 → 记下载成功，不记 shared", async () => {
    vi.mocked(shareCanvasAsPng).mockResolvedValue("downloaded");

    expect(await runShareCardFlow(args())).toBe("downloaded");
    expect(tracked().map((e) => [e.name, e.outcome])).toEqual([
      ["share_card_download", "started"],
      ["share_card_download", "succeeded"],
    ]);
  });

  it("用户在面板里取消 → 只有 started：既不算成功也不算失败", async () => {
    vi.mocked(shareCanvasAsPng).mockResolvedValue("cancelled");

    expect(await runShareCardFlow(args())).toBe("cancelled");
    expect(tracked().map((e) => [e.name, e.outcome])).toEqual([["share_card_download", "started"]]);
  });

  it("画布导不出图片 → 记 failed，不进 shared 分支", async () => {
    vi.mocked(shareCanvasAsPng).mockResolvedValue("failed");

    expect(await runShareCardFlow(args())).toBe("failed");
    expect(tracked().map((e) => [e.name, e.outcome])).toEqual([
      ["share_card_download", "started"],
      ["share_card_download", "failed"],
    ]);
  });

  it("画布还没画出来（ref 为空）→ 记 failed 且不猜平台能力", async () => {
    const outcome = await runShareCardFlow(args({ getCanvas: () => null }));

    expect(outcome).toBe("failed");
    expect(shareCanvasAsPng).not.toHaveBeenCalled();
    expect(tracked().at(-1)?.name).toBe("share_card_download");
    expect(tracked().at(-1)?.outcome).toBe("failed");
  });

  it("绘制抛错 → 记 failed，不把异常抛给按钮", async () => {
    const outcome = await runShareCardFlow(
      args({
        draw: async () => {
          throw new Error("font not ready");
        },
      }),
    );

    expect(outcome).toBe("failed");
    expect(tracked().at(-1)?.outcome).toBe("failed");
  });
});
