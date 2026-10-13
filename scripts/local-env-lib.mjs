/**
 * R16.335：脚本要读 `.env.local` 时，一律走这里，不再手搓解析器。
 *
 * 病灶：两处同形的手写解析（`scripts/faq-candidates.mjs`、`scripts/generate-embeddings.mjs`）
 * 用的是 `^([A-Z_]+)=(.*)$`，**不剥引号**。这不是理论问题：`npx vercel deploy` 会改写
 * `.env.local` 并把值加上字面双引号（2026-10-13 实测撞过一次，脚本当场崩，只能手工去引号恢复）。
 * 也就是说这两个运维脚本在「用过一次 vercel CLI」之后就会静默坏掉。
 *
 * 修法不自己发明：Node 20.12 / 21.7 起有内置 `process.loadEnvFile()`，语义与手搓版逐条一致——
 * **不覆盖已有环境变量**、**文件不存在抛错**（所以仍要 try/catch），而且正确处理引号、
 * `export` 前缀、值里含 `=`、注释行。实测口径（不是推断）：
 * - 本机 Node 26：`A_B="quoted value"` → `quoted value`；`export C_D=x` → 认；`E_F=has=equals` → `has=equals`；
 *   已存在的 `A_B=preset` 不被覆盖；缺文件抛 ENOENT。
 * - CI 同款镜像 `node:22-slim`（v22.23.3）：同一份夹具读数逐字相同。
 * 本仓 `engines.node` 是 `>=22`，所以不需要降级路径。
 *
 * 为什么不引 `dotenv`：内置的已经够用，而 AGENTS.md「Reuse First」要求先看在手的东西。
 */
import { existsSync } from "node:fs";

/**
 * 把一份 `.env` 风格的文件加载进 `process.env`（不覆盖已有值）。
 *
 * @param {string} filePath 绝对路径
 * @param {{log?: (msg: string) => void}} [options] 传入 log 时，文件不存在会印一行说明；
 *   不传则静默——两个调用点原本的行为就是「没有 .env.local 就依赖已有环境变量」。
 * @returns {boolean} 是否真的加载了
 */
export function loadLocalEnv(filePath, { log } = {}) {
  if (!existsSync(filePath)) {
    if (log) log(`[env] 未找到 ${filePath}，依赖已有环境变量`);
    return false;
  }
  process.loadEnvFile(filePath);
  return true;
}
