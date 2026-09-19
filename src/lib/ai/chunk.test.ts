import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  existing: new Set<string>(),
  files: new Map<string, string>(),
  chapters: ["getting-started"],
  docs: [{ slug: "test-doc", title: "Test", description: "" }],
  assertKnowledgeRoot: vi.fn(),
}));

vi.mock("node:fs", () => ({
  default: {
    existsSync: (filePath: string) => mocks.existing.has(filePath),
    readFileSync: (filePath: string) => mocks.files.get(filePath) ?? "",
  },
}));
vi.mock("@/lib/content", () => ({
  getChapterSlugs: () => mocks.chapters,
  getDocMetas: () => mocks.docs,
  assertKnowledgeRoot: mocks.assertKnowledgeRoot,
}));

const { getAllChunks } = await import("./chunk");
const root = `${process.cwd()}/content/kline-buty/docs/knowledge`;
const localeRoot = `${root}/zh`;
const chapterRoot = `${localeRoot}/getting-started`;
const docPath = `${chapterRoot}/test-doc.md`;

function documentWith(...sections: string[]) {
  return `---\ntitle: Test\n---\n# Test Doc\n\n${sections.join("\n\n")}`;
}

beforeEach(() => {
  mocks.existing.clear();
  mocks.files.clear();
  mocks.chapters = ["getting-started"];
  mocks.docs = [{ slug: "test-doc", title: "Test", description: "" }];
  mocks.assertKnowledgeRoot.mockClear();
  mocks.existing.add(localeRoot);
  mocks.existing.add(chapterRoot);
  mocks.existing.add(docPath);
  mocks.files.set(
    docPath,
    documentWith(
      `## 第一节\n\n${"市场基础。".repeat(20)}`,
      `## 第二节\n\n${"交易机制。".repeat(20)}`,
    ),
  );
});

describe("getAllChunks", () => {
  it("splits H2 sections, strips frontmatter, and attaches source metadata", () => {
    const chunks = getAllChunks("zh");

    expect(mocks.assertKnowledgeRoot).toHaveBeenCalledOnce();
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({
      chapter: "getting-started",
      doc: "test-doc",
      locale: "zh",
    });
    expect(chunks[0].chunk).toContain("## 第一节");
    expect(chunks[1].chunk).toContain("## 第二节");
    expect(chunks.every(({ chunk }) => !chunk.includes("title: Test"))).toBe(true);
  });

  it("filters chunks with at most 50 characters", () => {
    mocks.files.set(docPath, documentWith("## 短节\n\n太短。", `## 长节\n\n${"有效内容。".repeat(20)}`));

    const chunks = getAllChunks("zh");

    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunk).toContain("## 长节");
  });

  it("splits oversized content and never emits a chunk above the embedding limit", () => {
    mocks.files.set(docPath, documentWith(`## 超长段落\n\n${"长文本".repeat(900)}`));

    const chunks = getAllChunks("zh");

    expect(chunks.length).toBeGreaterThan(1);
    expect(Math.max(...chunks.map(({ chunk }) => chunk.length))).toBeLessThanOrEqual(2000);
    expect(chunks.map(({ chunk }) => chunk).join("")).toContain("长文本".repeat(900));
  });

  it("preserves a short tail when hard-splitting one long paragraph", () => {
    mocks.files.set(docPath, documentWith(`## 边界段落\n\n${"字".repeat(2001)}`));

    const chunks = getAllChunks("zh");
    const combined = chunks.map(({ chunk }) => chunk).join("");

    expect(chunks.every(({ chunk }) => chunk.length <= 2000 && chunk.length > 50)).toBe(true);
    expect([...combined].filter((char) => char === "字")).toHaveLength(2001);
  });

  it("returns no chunks when the requested locale root is absent", () => {
    mocks.existing.delete(localeRoot);

    expect(getAllChunks("en")).toEqual([]);
    expect(mocks.assertKnowledgeRoot).toHaveBeenCalledOnce();
  });

  it("skips missing chapter directories and lesson files", () => {
    mocks.chapters = ["getting-started", "missing-chapter"];
    mocks.docs = [
      { slug: "test-doc", title: "Test", description: "" },
      { slug: "missing-doc", title: "Missing", description: "" },
    ];

    const chunks = getAllChunks("zh");

    expect(chunks).toHaveLength(2);
    expect(chunks.every(({ doc }) => doc === "test-doc")).toBe(true);
  });
});
