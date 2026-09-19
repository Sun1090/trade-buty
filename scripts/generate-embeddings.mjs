/**
 * P3 AI 陪学：知识库 embedding 生成脚本
 *
 * 遍历知识库 → 分块 → 调 embedding API → 写入 Supabase pgvector。
 * 幂等：先完整生成向量，再替换旧索引（避免模型失败清空线上数据）。
 *
 * 用法：node --import tsx scripts/generate-embeddings.mjs
 * 需要：AI_EMBEDDING_* + SUPABASE_SERVICE_ROLE_KEY 环境变量
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { replaceLocaleEmbeddings } from "./generate-embeddings-lib.mjs";

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
    console.log(`🧠 先生成全部 embedding，成功后再替换 ${locale} 索引...`);

    const written = await replaceLocaleEmbeddings({
      supabaseUrl: SUPABASE_URL,
      serviceKey: SERVICE_KEY,
      aiUrl: AI_URL,
      aiKey: AI_KEY,
      model: EMBED_MODEL,
      locale,
      chunks,
      onProgress(done, count) {
        process.stdout.write(`\r  ✅ ${done}/${count} 块已写入`);
      },
    });
    total += written;
    console.log("");
  }

  console.log(`\n🎉 完成：共 ${total} 块 embedding 已写入 pgvector`);
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
