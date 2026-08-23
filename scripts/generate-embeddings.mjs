/**
 * P3 AI 陪学：知识库 embedding 生成脚本
 *
 * 遍历知识库 → 分块 → 调 embedding API → 写入 Supabase pgvector。
 * 幂等：每次运行先清旧再写新（避免重复）。
 *
 * 用法：node --import tsx scripts/generate-embeddings.mjs
 * 需要：AI_EMBEDDING_* + SUPABASE_SERVICE_ROLE_KEY 环境变量
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// 手动加载 .env.local（不引 dotenv 依赖）
const __root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  for (const line of readFileSync(join(__root, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // .env.local 不存在则依赖已有环境变量
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AI_URL = process.env.AI_EMBEDDING_URL || process.env.AI_API_URL;
const AI_KEY = process.env.AI_EMBEDDING_KEY || process.env.AI_API_KEY;
const EMBED_MODEL = process.env.AI_EMBEDDING_MODEL || "text-embedding-3-small";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ 缺少 SUPABASE 环境变量");
  process.exit(1);
}
if (!AI_URL || !AI_KEY) {
  console.error("❌ 缺少 AI_EMBEDDING_URL / AI_EMBEDDING_KEY 环境变量");
  process.exit(1);
}

async function main() {
  const { getAllChunks } = await import("../src/lib/ai/chunk.ts");
  const locales = ["zh"]; // en 待内容补齐后再生成
  let total = 0;

  for (const locale of locales) {
    const chunks = getAllChunks(locale);
    console.log(`\n📦 ${locale} 知识库分块：${chunks.length} 块`);

    // 先清旧数据
    console.log(`🗑  清理 ${locale} 旧 embedding...`);
    await fetch(`${SUPABASE_URL}/rest/v1/kb_embeddings?locale=eq.${locale}`, {
      method: "DELETE",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });

    // 批量生成（每批 20 个，避免 API 限流）
    const BATCH = 20;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      const rows = [];
      for (const c of batch) {
        try {
          const emb = await embed(c.chunk);
          rows.push({ ...c, embedding: emb });
        } catch (e) {
          console.error(`\n  ⚠ 块 ${c.chapter}/${c.doc} embed 失败:`, e.message);
        }
      }
      // 批量插入
      if (rows.length > 0) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/kb_embeddings`, {
          method: "POST",
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify(rows),
        });
        if (!res.ok) {
          console.error(`\n  ⚠ 批 ${i} 插入失败: ${res.status} ${await res.text()}`);
        }
      }
      total += rows.length;
      process.stdout.write(`\r  ✅ ${total}/${chunks.length} 块已写入`);
    }
    console.log("");
  }

  console.log(`\n🎉 完成：共 ${total} 块 embedding 已写入 pgvector`);
}

async function embed(text) {
  const res = await fetch(`${AI_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_KEY}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!res.ok) throw new Error(`embed ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data[0].embedding;
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
