// @vitest-environment node
/**
 * 宽容模式契约（AGENTS.md）：知识库文档缺 frontmatter、缺 README、甚至「文件名像课文
 * 却读不出来」时，必须**告警并跳过**，绝不能把构建或页面打崩。这些降级分支跑在真实
 * 子模块上永远进不来，所以这里搭一棵临时知识树，把 cwd 指过去重新加载模块。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const WARN = "[content]";

let sandbox: string;
let previousCwd: string;
let warnings: string[];

async function loadContentModule() {
  vi.resetModules();
  return await import("./content");
}

beforeEach(() => {
  previousCwd = process.cwd();
  sandbox = mkdtempSync(path.join(tmpdir(), "kb-lenient-"));
  const knowledge = path.join(sandbox, "content/kline-buty/docs/knowledge");

  mkdirSync(path.join(knowledge, "zh/alpha"), { recursive: true });
  writeFileSync(
    path.join(knowledge, "zh/alpha/README.md"),
    "---\ntitle: '01 · Alpha'\ndescription: alpha intro\n---\n\n# 01 · Alpha\n\n章节导语段落。\n"
  );
  writeFileSync(
    path.join(knowledge, "zh/alpha/lesson-ok.md"),
    "---\ntitle: '01 · 正常课文'\ndescription: 有 frontmatter\n---\n\n正文。\n"
  );
  writeFileSync(
    path.join(knowledge, "zh/alpha/lesson-broken-yaml.md"),
    '---\ntitle: "未闭合\n---\n\n回退到这里的第一段。\n'
  );
  writeFileSync(
    path.join(knowledge, "zh/alpha/lesson-no-frontmatter.md"),
    "# 只有正文的课文\n\n没有 frontmatter 的首段。\n"
  );

  mkdirSync(path.join(knowledge, "zh/beta"), { recursive: true });
  // 没有 README；目录里还有一个「名字像课文但根本不是文件」的条目
  mkdirSync(path.join(knowledge, "zh/beta/not-really-a-lesson.md"));

  warnings = [];
  vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
  });

  process.chdir(sandbox);
});

afterEach(() => {
  process.chdir(previousCwd);
  rmSync(sandbox, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("content 宽容模式", () => {
  it("知识树缺失时给出可执行的错误，而不是空页面", async () => {
    const content = await loadContentModule();
    expect(() => content.assertKnowledgeRoot()).not.toThrow();

    process.chdir(previousCwd);
    const empty = mkdtempSync(path.join(tmpdir(), "kb-absent-"));
    process.chdir(empty);
    try {
      const bare = await loadContentModule();
      expect(() => bare.assertKnowledgeRoot()).toThrow(/git submodule update --init/);
      expect(() => bare.getChapterSlugs("zh")).toThrow(/git submodule update --init/);
    } finally {
      process.chdir(sandbox);
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("缺 README 的章节降级为 slug 标题与空导语，不抛错", async () => {
    const content = await loadContentModule();
    const chapters = content.getChapters("zh");
    const beta = chapters.find((c: { slug: string }) => c.slug === "beta");

    expect(beta).toMatchObject({ slug: "beta", title: "beta", tagline: "", docCount: 1 });
    expect(warnings.join("\n")).toContain(`${WARN} 篇章导语缺失: zh/beta`);

    const intro = content.getChapter("zh", "beta");
    expect(intro?.introContent).toBe("");
    expect(content.getChapter("zh", "no-such-chapter")).toBeNull();
  });

  it("坏 frontmatter 与缺 frontmatter 都回退到文件名 / 首个 H1", async () => {
    const content = await loadContentModule();
    const metas = content.getDocMetas("zh", "alpha");
    const slugs = metas.map((m: { slug: string }) => m.slug);

    expect(slugs).toEqual(
      expect.arrayContaining([
        "lesson-ok",
        "lesson-broken-yaml",
        "lesson-no-frontmatter",
      ])
    );

    const pick = (slug: string) => metas.find((m: { slug: string }) => m.slug === slug)!;
    const broken = pick("lesson-broken-yaml");
    const bare = pick("lesson-no-frontmatter");

    // 解析失败只降级到文件名，不抛错；正文侧的 frontmatter 剥离是已知遗留（见 progress）
    expect(broken.title).toBe("lesson-broken-yaml");
    expect(typeof broken.description).toBe("string");
    expect(warnings.join("\n")).toContain(`${WARN} frontmatter 解析失败，降级处理: lesson-broken-yaml`);

    expect(bare.title).toContain("只有正文的课文");
    expect(bare.description).toContain("没有 frontmatter 的首段");
  });

  it("读不出来的课文被跳过并告警，getDoc 返回 null", async () => {
    const content = await loadContentModule();
    expect(content.getDocMetas("zh", "beta")).toEqual([]);
    expect(warnings.join("\n")).toContain(
      `${WARN} 文档解析失败，告警跳过（宽容模式）: not-really-a-lesson.md`
    );
    expect(content.getDoc("zh", "beta", "not-really-a-lesson")).toBeNull();
    expect(content.getDoc("zh", "alpha", "missing-lesson")).toBeNull();
    expect(content.getDoc("zh", "alpha", "lesson-ok")?.content).toContain("正文");
  });

  it("未知 slug 的章节退回字母序，课文邻居也能安全兜底", async () => {
    const content = await loadContentModule();
    expect(content.getChapterSlugs("zh")).toEqual(["alpha", "beta"]);
    const metas = content.getDocMetas("zh", "alpha");
    expect(content.getAdjacentDocs("zh", "alpha", metas[0].slug).prev).toBeNull();
    expect(content.getAdjacentChapters("zh", "alpha").next?.slug).toBe("beta");
    expect(content.getAdjacentChapters("zh", "beta").prev?.slug).toBe("alpha");
    expect(content.getAdjacentDocs("zh", "alpha", "no-such-doc")).toEqual({ prev: null, next: null });
  });
});
