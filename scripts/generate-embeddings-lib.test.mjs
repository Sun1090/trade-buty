import { describe, expect, it, vi } from "vitest";
import { embedText, replaceLocaleEmbeddings } from "./generate-embeddings-lib.mjs";

const chunk = { chapter: "spot", doc: "orders", locale: "zh", chunk: "有效课程内容" };
const generationId = "11111111-1111-4111-8111-111111111111";
const ok = (body = null) => ({
  ok: true,
  status: 200,
  text: async () => "",
  json: async () => body,
});
const fail = (status, body) => ({ ok: false, status, text: async () => body });
const options = {
  supabaseUrl: "https://db.example",
  serviceKey: "service-secret",
  aiUrl: "https://ai.example",
  aiKey: "ai-secret",
  model: "embedding-model",
  locale: "zh",
  generationId,
};

describe("embedding generation safety", () => {
  it("validates the embedding response shape", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ data: [] }));
    await expect(embedText({ ...options, fetchImpl, text: "content" })).rejects.toThrow(
      "missing data[0].embedding",
    );
  });

  it("refuses to replace a locale when chunk generation is empty", async () => {
    const fetchImpl = vi.fn();
    await expect(replaceLocaleEmbeddings({ ...options, fetchImpl, chunks: [] })).rejects.toThrow(
      "refusing to replace zh embeddings with an empty index",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("generates every embedding before staging database rows", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ok({ data: [{ embedding: [0.1] }] }))
      .mockResolvedValueOnce(fail(429, "limited"));

    await expect(
      replaceLocaleEmbeddings({ ...options, fetchImpl, chunks: [chunk, { ...chunk, doc: "risk" }] }),
    ).rejects.toThrow("embed 429: limited");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls.some(([url]) => String(url).includes("kb_embeddings"))).toBe(false);
  });

  it("stages one generation in batches, then atomically activates it", async () => {
    const chunks = Array.from({ length: 3 }, (_, index) => ({ ...chunk, doc: `doc-${index}` }));
    const fetchImpl = vi.fn(async (url) => {
      if (url.includes("/embeddings")) return ok({ data: [{ embedding: [0.1, 0.2] }] });
      return ok();
    });
    const onProgress = vi.fn();

    await expect(
      replaceLocaleEmbeddings({ ...options, fetchImpl, chunks, batchSize: 2, onProgress }),
    ).resolves.toBe(3);
    expect(onProgress.mock.calls).toEqual([[2, 3], [3, 3]]);

    const stagedPosts = fetchImpl.mock.calls.filter(
      ([url, init]) => String(url).endsWith("/kb_embeddings") && init?.method === "POST",
    );
    expect(stagedPosts).toHaveLength(2);
    const stagedRows = stagedPosts.flatMap(([, init]) => JSON.parse(String(init.body)));
    expect(stagedRows).toHaveLength(3);
    expect(stagedRows.every((row) => row.generation === generationId)).toBe(true);

    const activation = fetchImpl.mock.calls.find(([url]) =>
      String(url).endsWith("/rpc/activate_kb_embedding_generation"),
    );
    expect(JSON.parse(String(activation[1].body))).toEqual({
      target_locale: "zh",
      target_generation: generationId,
    });
  });

  it("cleans a staged generation after an insertion failure", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ok({ data: [{ embedding: [0.1] }] }))
      .mockResolvedValueOnce(fail(400, "dimension mismatch"))
      .mockResolvedValueOnce(ok());

    await expect(replaceLocaleEmbeddings({ ...options, fetchImpl, chunks: [chunk] })).rejects.toThrow(
      "insert zh batch 0 400: dimension mismatch",
    );
    expect(fetchImpl).toHaveBeenLastCalledWith(
      expect.stringContaining(`generation=eq.${generationId}`),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("keeps the active generation unchanged and cleans staging when activation fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ok({ data: [{ embedding: [0.1] }] }))
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(fail(503, "activation unavailable"))
      .mockResolvedValueOnce(ok());

    await expect(replaceLocaleEmbeddings({ ...options, fetchImpl, chunks: [chunk] })).rejects.toThrow(
      "activate zh generation 503: activation unavailable",
    );
    expect(fetchImpl).toHaveBeenLastCalledWith(
      expect.stringContaining(`generation=eq.${generationId}`),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("reports both refresh and cleanup errors", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ok({ data: [{ embedding: [0.1] }] }))
      .mockResolvedValueOnce(fail(400, "bad vector"))
      .mockResolvedValueOnce(fail(503, "cleanup unavailable"));

    await expect(replaceLocaleEmbeddings({ ...options, fetchImpl, chunks: [chunk] })).rejects.toThrow(
      "embedding refresh and cleanup failed for zh",
    );
  });
});
