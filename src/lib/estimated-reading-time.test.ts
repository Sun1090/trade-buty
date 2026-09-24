import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { estimateReadingMinutes } from "./estimated-reading-time";
import { dropInlineTags } from "./md-utils";

describe("estimateReadingMinutes", () => {
  it("returns zero for empty content", () => {
    expect(estimateReadingMinutes("")).toBe(0);
    expect(estimateReadingMinutes("   \n")).toBe(0);
  });

  it("rounds Chinese prose at 300 characters per minute", () => {
    expect(estimateReadingMinutes("中".repeat(300))).toBe(1);
    expect(estimateReadingMinutes("中".repeat(301))).toBe(2);
  });

  it("rounds English prose at 200 words per minute", () => {
    expect(estimateReadingMinutes(Array.from({ length: 200 }, () => "word").join(" "))).toBe(1);
    expect(estimateReadingMinutes(Array.from({ length: 201 }, () => "word").join(" "))).toBe(2);
  });

  it("combines Chinese and English reading time before rounding", () => {
    const content = `${"中".repeat(150)} ${Array.from({ length: 100 }, () => "word").join(" ")}`;
    expect(estimateReadingMinutes(content)).toBe(1);
  });

  it("does not count fenced code, inline code, or link URLs", () => {
    const content = [
      "Read this [short lesson](https://example.com/" + "very-long-url".repeat(50) + ").",
      "`const shouldNotCount = " + "'word '.repeat(1000)" + "`",
      "```ts",
      "const code = " + "'word '.repeat(1000)" + ";",
      "```",
    ].join("\n");
    expect(estimateReadingMinutes(content)).toBe(1);
  });

  it("keeps link and image labels as visible reader content", () => {
    const content = `[${"中".repeat(300)}](https://example.com) ![${"字".repeat(300)}](image.png)`;
    expect(estimateReadingMinutes(content)).toBe(2);
  });

  it("ignores markdown heading and list markers", () => {
    const content = Array.from({ length: 200 }, (_, i) => `- word${i}`).join("\n");
    expect(estimateReadingMinutes(content)).toBe(1);
  });

  it("< 与 > 之间的中文照算：比较句不被当成标签吞掉", () => {
    // 旧的 `/<[^>]+>/g` 会从 `<` 一路吃到最近的 `>`，把中间整句真课文抹掉。
    // 影响面见本文件最后那条逐篇测量——以前这里抄过一组没人复算得出的总量。
    const prose = "风险".repeat(300); // 600 字 ≈ 2 分钟
    const compared = `口径 < ${prose} 上行 > 成本`;
    const plain = `口径 ${prose} 上行 成本`;
    expect(estimateReadingMinutes(compared)).toBe(estimateReadingMinutes(plain));
    expect(estimateReadingMinutes(compared)).toBeGreaterThanOrEqual(2);
  });

  it("真正的内联标签仍然不算进阅读时间", () => {
    const tagged = `前文 <mark>${"字".repeat(600)}</mark> 后文`;
    const stripped = `前文 ${"字".repeat(600)} 后文`;
    expect(estimateReadingMinutes(tagged)).toBe(estimateReadingMinutes(stripped));
  });

  /**
   * R16.156：这三处注释以前各写着一组「实测」总量（118 个文件 / 144,762 个字符 /
   * 67 篇被低估），而台账 R16.118 记的是 62 篇 / 109 分钟——两种口径都没人能复算出来
   * （2026-09-25 再量一次得到的是 72 篇）。总量留不住，就把它换成一条自己会跑的测量：
   * 逐篇比「旧吃法 `/<[^>]+>/g`」与「新吃法 `dropInlineTags`」的分钟差。
   * 知识库由 `check:kb-pointer` 钉着，所以这个数是稳定的；内容一动它会红，
   * 那时要改的是注释里的数，而不是把断言放宽。
   */
  it("整棵知识库上，旧吃法最多把一篇的预计阅读少算 8 分钟", () => {
    const root = path.join(process.cwd(), "content/kline-buty/docs/knowledge");
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (entry.name.endsWith(".md") && entry.name !== "README.md") out.push(full);
      }
      return out;
    };
    const files = [...walk(path.join(root, "zh")), ...walk(path.join(root, "en"))];
    expect(files.length, "课文文件没扫到，这条测量是空转").toBeGreaterThan(300);

    let worst = 0;
    let worstFile = "";
    let affected = 0;
    for (const file of files) {
      const raw = fs.readFileSync(file, "utf8");
      const body = raw.startsWith("---\n") ? raw.slice(raw.indexOf("\n---", 3) + 4) : raw;
      const before = estimateReadingMinutes(body.replace(/<[^>]+>/g, ""));
      const after = estimateReadingMinutes(dropInlineTags(body));
      if (after > before) {
        affected += 1;
        if (after - before > worst) {
          worst = after - before;
          worstFile = path.relative(root, file);
        }
      }
    }
    expect(affected).toBeGreaterThan(0);
    expect(worst).toBe(8);
    expect(worstFile).toBe(path.join("zh", "trading-practice", "a-share-playbook.md"));
  });
});
