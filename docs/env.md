# 环境变量

> 本文件是环境变量的权威说明，`.env.example` 是它的可复制版本（`cp .env.example .env.local`）；
> 除 `.env.example` 外 `.env*` 全被 gitignore，所以真实凭据不会入库。
> 两份由 `npm run check:env-docs` 与代码三方对账，谁漏了变量或留了幽灵条目都会挂 CI。
> 线上写入 Vercel → Project Settings → Environment Variables。
>
> `NEXT_PUBLIC_` 前缀的变量在构建期内联进浏览器 bundle，可被任何访客读到；
> 其余变量只在服务端可见。服务端密钥（`SUPABASE_SERVICE_ROLE_KEY`、`ADMIN_TOKEN`、
> `AI_API_KEY`、`AI_EMBEDDING_KEY`）**绝不许**加 `NEXT_PUBLIC_` 前缀。
> 本文件由 `npm run check:env-docs` 与代码对账：漏登记、幽灵条目、密钥进客户端模块都会挂 CI。

## Supabase（P2 数据层 + Auth）

| 变量 | 必需 | 说明 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 是 | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 是 | 浏览器端 key（受 RLS 约束） |
| `SUPABASE_SERVICE_ROLE_KEY` | 是 | 仅服务端（绕过 RLS，绝不进客户端 bundle） |

缺 key 时行为：登录/API 相关功能降级（本地模式照常可用），不打挂构建。

## AI（P3 陪学，兼容 OpenAI 接口）

| 变量 | 必需 | 说明 |
|---|---|---|
| `AI_API_URL` | AI 功能要 | 对话端点（OpenAI / OpenRouter / DeepSeek 均可） |
| `AI_API_KEY` | AI 功能要 | 对话 key |
| `AI_MODEL` | 否 | 首选模型（默认走内置 fallback 链） |
| `AI_EMBEDDING_URL` | RAG 要 | embedding 端点（可与对话端点不同） |
| `AI_EMBEDDING_MODEL` | RAG 要 | embedding 模型 |
| `AI_EMBEDDING_KEY` | RAG 要 | embedding key（可与对话 key 不同） |
| `AI_RETRIEVAL_JSON` | 否 | 检索配置覆盖，如 `{"chat":{"threshold":0.25}}`；`threshold` 必须是 `0..1`，`topK` 取整且 `0` 回退默认，`relaxedTopK` 允许 `0` 表示关闭兜底（见 R1.4） |
| `NEXT_PUBLIC_AI_ENABLED` | 否 | 紧急总开关：设为字符串 `false` 时隐藏全部 AI 入口（R3.10），其它值或未设均视为开启；构建期内联到客户端 |

无 AI key 时：AI 页显示未配置态，不阻断其他功能。

**但 `AI_API_KEY` 的判定发生在构建期**：`aiEnabledForPage()`（`src/lib/ai-toggle.ts`）读的是服务端环境变量，
而 AI 页、课程页、章节页都是 SSG——入口显示与否被**烘进静态 HTML**。
所以只在 Vercel 上补 key 不重新部署，API 会活过来而页面仍然显示「AI 功能暂未开启」（反向同理：撤掉 key 后
旧 HTML 还会把入口留着，点下去就是 502）。改完 `AI_*` 之后必须触发一次部署才与运行期一致。
两条信号分别怎么判：运行期看 `npm run ops:smoke-prod` 的游客 `POST /api/ai/chat` 探针（它先打一次必被红线拦下的
问题：护栏 200 而模型 502 → 缺的是运行期配置或出口；护栏那条也异常 → 函数没起来或部署落后，与 key 无关）；
构建期看部署后的 `/zh/ai` 是否还停在「AI 功能暂未开启」。两边不一致就说明少了一次重新部署。

紧急关闭：把 `NEXT_PUBLIC_AI_ENABLED` 设为 `false` 并重新部署，即可在所有页面隐藏 AI 入口（不改代码、不回滚）。

## 运营

| 变量 | 必需 | 说明 |
|---|---|---|
| `ADMIN_TOKEN` | 否 | 反馈导出接口鉴权（`Authorization: Bearer`），不设则导出接口一律 401 |
| `NEXT_PUBLIC_SITE_URL` | 否 | 对外站点地址（OG/sitemap 回退用，默认 vercel.app 域名） |
