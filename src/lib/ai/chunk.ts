/**
 * P3 AI 陪学：知识库分块（chunking）
 *
 * 按 H2 标题切分课程内容，每块含 chapter/doc 元信息。
 * 过大块（>2000 字符）再按段落切。供 embedding 脚本消费。
 */
import fs from "node:fs";
import path from "node:path";
import { getChapterSlugs, getDocMetas, assertKnowledgeRoot } from "@/lib/content";

const KNOWLEDGE_ROOT = path.join(process.cwd(), "content/kline-buty/docs/knowledge");
const MAX_CHUNK_LENGTH = 2000;

export interface KbChunk {
  chapter: string;
  doc: string;
  locale: string;
  chunk: string;
}

function splitOversizedBlock(block: string): string[] {
  const chunks: string[] = [];
  let current = "";

  function flush() {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  }

  for (const paragraph of block.split(/\n\n+/)) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    if (trimmed.length > MAX_CHUNK_LENGTH) {
      flush();
      const chunkCount = Math.ceil(trimmed.length / MAX_CHUNK_LENGTH);
      const chunkLength = Math.ceil(trimmed.length / chunkCount);
      for (let offset = 0; offset < trimmed.length; offset += chunkLength) {
        chunks.push(trimmed.slice(offset, offset + chunkLength));
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${trimmed}` : trimmed;
    if (candidate.length > MAX_CHUNK_LENGTH) flush();
    current = current ? `${current}\n\n${trimmed}` : trimmed;
  }
  flush();
  return chunks;
}

/** 去掉 frontmatter，按 ## 切分 */
function splitByH2(md: string): string[] {
  const body = md.replace(/^---[\s\S]*?---\s*/, "");
  const sections = body.split(/\n(?=#{1,3}\s)/);
  const chunks: string[] = [];
  let buffer = "";

  for (const section of sections) {
    if (section.match(/^##\s/) && buffer) {
      chunks.push(buffer.trim());
      buffer = section;
    } else {
      buffer += (buffer ? "\n" : "") + section;
    }
    // 单块过大按段落切
    if (buffer.length > MAX_CHUNK_LENGTH) {
      chunks.push(...splitOversizedBlock(buffer));
      buffer = "";
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim());
  return chunks.filter((c) => c.length > 50); // 太短的丢
}

/** 遍历全部课程，生成 chunk 列表 */
export function getAllChunks(locale: string = "zh"): KbChunk[] {
  assertKnowledgeRoot();
  const root = path.join(KNOWLEDGE_ROOT, locale);
  if (!fs.existsSync(root)) return [];
  const chunks: KbChunk[] = [];

  for (const chapter of getChapterSlugs(locale)) {
    const chapterDir = path.join(root, chapter);
    if (!fs.existsSync(chapterDir)) continue;
    for (const doc of getDocMetas(locale, chapter)) {
      const filePath = path.join(chapterDir, `${doc.slug}.md`);
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, "utf8");
      for (const chunk of splitByH2(raw)) {
        chunks.push({ chapter, doc: doc.slug, locale, chunk });
      }
    }
  }
  return chunks;
}
