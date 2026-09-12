# 环境变量

> 本文件是唯一受版本控制的环境变量说明。`.env*` 全被 gitignore，
> 本地复制以下变量写入 `.env.local`；线上写入 Vercel → Project Settings → Environment Variables。
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
| `AI_RETRIEVAL_JSON` | 否 | 检索配置覆盖，如 `{"chat":{"threshold":0.25}}`（见 R1.4） |
| `NEXT_PUBLIC_AI_ENABLED` | 否 | 紧急总开关：设为字符串 `false` 时隐藏全部 AI 入口（R3.10），其它值或未设均视为开启；构建期内联到客户端 |

无 AI key 时：AI 页显示未配置态，不阻断其他功能。

紧急关闭：把 `NEXT_PUBLIC_AI_ENABLED` 设为 `false` 并重新部署，即可在所有页面隐藏 AI 入口（不改代码、不回滚）。

## 运营

| 变量 | 必需 | 说明 |
|---|---|---|
| `ADMIN_TOKEN` | 否 | 反馈导出接口鉴权（`Authorization: Bearer`），不设则导出接口一律 401 |
| `NEXT_PUBLIC_SITE_URL` | 否 | 对外站点地址（OG/sitemap 回退用，默认 vercel.app 域名） |
