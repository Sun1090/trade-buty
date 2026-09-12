import { beforeEach, describe, expect, it, vi } from "vitest";

const embed = vi.fn();
const rpc = vi.fn();
vi.mock("./client", () => ({ embed: (...args: unknown[]) => embed(...args) }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ rpc }),
}));

const { retrieve } = await import("./rag");

function rows(items: { chapter: string; doc: string; similarity: number }[]) {
  return items.map((it, i) => ({ ...it, chunk: `chunk-${i}` }));
}

beforeEach(() => {
  vi.clearAllMocks();
  embed.mockResolvedValue([0.1, 0.2, 0.3]);
  rpc.mockResolvedValue({ data: [], error: null });
});

describe("retrieve (RAG)", () => {
  it("embedding 为空时直接返回 []，不查库", async () => {
    embed.mockResolvedValue([]);
    expect(await retrieve("q")).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("无章节过滤：match_count = topK，透传 threshold 与 locale", async () => {
    await retrieve("q", "en", 3, 0.4);
    expect(rpc).toHaveBeenCalledWith("match_kb_embeddings", {
      query_embedding: [0.1, 0.2, 0.3],
      match_locale: "en",
      match_count: 3,
      threshold: 0.4,
    });
  });

  it("映射后的字段裁剪为 RagResult（丢弃多余列）", async () => {
    rpc.mockResolvedValue({
      data: [{ ...rows([{ chapter: "spot", doc: "d", similarity: 0.9 }])[0], extra: "x" }],
      error: null,
    });
    const out = await retrieve("q");
    expect(out).toEqual([{ chapter: "spot", doc: "d", chunk: "chunk-0", similarity: 0.9 }]);
  });

  it("章节过滤：超采 topK*4，按章过滤后截断回 topK", async () => {
    embed.mockResolvedValue([1]);
    rpc.mockResolvedValue({
      data: rows([
        { chapter: "spot", doc: "a", similarity: 0.9 },
        { chapter: "futures", doc: "b", similarity: 0.8 },
        { chapter: "spot", doc: "c", similarity: 0.7 },
        { chapter: "spot", doc: "d", similarity: 0.6 },
        { chapter: "spot", doc: "e", similarity: 0.5 },
      ]),
      error: null,
    });
    const out = await retrieve("q", "zh", 2, 0.3, "spot");
    expect(rpc.mock.calls[0][1].match_count).toBe(8);
    expect(out.map((r) => r.doc)).toEqual(["a", "c"]);
    expect(out.every((r) => r.chapter === "spot")).toBe(true);
  });

  it("RPC 报错：返回 [] 且不抛错（降级）", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "function does not exist" } });
    expect(await retrieve("q")).toEqual([]);
  });

  it("data 为 null 时返回 []", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await retrieve("q")).toEqual([]);
  });
});
