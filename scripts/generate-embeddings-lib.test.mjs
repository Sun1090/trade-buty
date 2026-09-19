import { describe, expect, it, vi } from "vitest";
import { embedText, replaceLocaleEmbeddings } from "./generate-embeddings-lib.mjs";

const chunk = { chapter: "spot", doc: "orders", locale: "zh", chunk: "有效课程内容" };
const ok = (body = null) => ({
  ok: true,
  status: 200,
  text: async () => "",
  json: async () => body,
});
const fail = (status, body) => ({
  ok: false,
  status,
  text: async () => body,
});

const options = {
  supabaseUrl: "https://db.example",
  serviceKey: "service-secret",
  aiUrl: "https://ai.example",
  aiKey: "ai-secret",
  model: "embedding-model",
  locale: "zh",
};

describe("embedding generation safety", () => {
  it("validates the embedding response shape", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ data: [] }));
    await expect(embedText({ ...options, fetchImpl, text: "content" })).rejects.toThrow(
      "missing data[0].embedding",
    );
  });

  it("refuses to erase a locale when chunk generation is empty", async () => {
    const fetchImpl = vi.fn();
    await expect(replaceLocaleEmbeddings({ ...options, fetchImpl, chunks: [] })).rejects.toThrow(
      "refusing to replace zh embeddings with an empty index",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("generates every embedding before deleting the live index", async () => {
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

  it("checks deletion and does not insert when deletion fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ok({ data: [{ embedding: [0.1] }] }))
      .mockResolvedValueOnce(fail(503, "database unavailable"));

    await expect(replaceLocaleEmbeddings({ ...options, fetchImpl, chunks: [chunk] })).rejects.toThrow(
      "delete zh embeddings 503: database unavailable",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("writes generated rows in batches and reports progress", async () => {
    const chunks = Array.from({ length: 3 }, (_, index) => ({ ...chunk, doc: `doc-${index}` }));
    const fetchImpl = vi.fn(async (url, init) => {
      if (url.includes("/embeddings")) return ok({ data: [{ embedding: [0.1, 0.2] }] });
      if (init?.method === "DELETE") return ok();
      return ok();
    });
    const onProgress = vi.fn();

    await expect(
      replaceLocaleEmbeddings({ ...options, fetchImpl, chunks, batchSize: 2, onProgress }),
    ).resolves.toBe(3);
    expect(onProgress.mock.calls).toEqual([[2, 3], [3, 3]]);
    const posts = fetchImpl.mock.calls.filter(([url, init]) => String(url).includes("kb_embeddings") && init?.method === "POST");
    expect(JSON.parse(String(posts[0][1]?.body))).toHaveLength(2);
    expect(JSON.parse(String(posts[1][1]?.body))).toHaveLength(1);
  });

  it("surfaces insertion failures instead of reporting a false success", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ok({ data: [{ embedding: [0.1] }] }))
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(fail(400, "dimension mismatch"));

    await expect(replaceLocaleEmbeddings({ ...options, fetchImpl, chunks: [chunk] })).rejects.toThrow(
      "insert zh batch 0 400: dimension mismatch",
    );
  });
});
