# 分享与邀请转化事件（R13.19）

最后更新：2026-09-12

## 0. 当前边界

这一版只定义并实现 **本地 debug 事件**：

- 出口只有 `console.info("[growth-event]", name, payload)`；
- 不发送网络请求，不写 cookie / localStorage，不读取账号、邮箱或邀请 `ref`；
- 事件失败永远静默，不能阻断分享、下载、复制链接或邀请 banner 主流程；
- 代码通过判别联合和运行时白名单重建 payload，额外字段会在落日志前被剥离。

这不是分析 SDK，也不代表已经接入 PostHog、Vercel Analytics 或任何远端遥测。后续若接入远端收集器，
必须先完成 `R13.20` 隐私审计，并重新评估隐私政策与服务商清单。

## 1. 事件目录

| 事件 | 触发点 | 允许字段 | 用途 |
| --- | --- | --- | --- |
| `share_card_download` | 分享卡 / 落地页下载 | `card`, `locale`, `surface`, `trigger`, `outcome` | 识别分享素材生成漏斗与失败率 |
| `share_preview_opened` | 站内分享卡成功生成预览 | `card`, `locale` | 比较预览与直接下载的使用偏好 |
| `share_link_copy` | 复制分享链接成功或失败 | `card`, `locale`, `outcome` | 观察复制链路成功率 |
| `share_landing_cta_clicked` | 分享落地页 CTA 点击 | `card`, `locale`, `destination` | 判断访客进入学习路线还是回放训练 |
| `invite_banner_viewed` | 邀请 banner 首次展示 | `locale`, `source` | 区分 URL 新邀请与本地既有邀请 |
| `invite_banner_dismissed` | 用户点击“知道了” | `locale` | 衡量邀请提示打扰程度 |
| `invite_banner_cleared` | 用户主动清除邀请 | `locale` | 区分关闭提示与删除邀请记录 |

### 枚举

- `card`: `quiz` | `replay` | `streak`
- `locale`: `zh` | `en`
- `surface`: `owner`（站内生成者） | `landing`（分享落地访客）
- `trigger`: `share`（分享按钮） | `preview`（预览后的下载）
- `outcome`: `started` | `succeeded` | `failed`；复制链接只允许后两者
- `destination`: `path` | `replay`
- `source`: `url` | `storage`

## 2. 明确禁止的字段

- 原始 `ref`、邀请人标识、邮箱、账户 ID 或任何身份关联；
- 章节标题、课程 slug、文件名、自由文本；
- 完整 URL、query string、分享 payload、设备指纹或精确时间戳；
- 用户答案、分数、币种、周期等可用于还原个人学习行为的明细。

事件只保留枚举和有限的布尔式漏斗阶段。`locale` 用于内容语言归因，不接受任意字符串。

## 3. 漏斗口径

### 分享

1. `share_card_download` / `outcome=started`
2. `share_card_download` / `outcome=succeeded|failed`
3. 若使用链接：`share_link_copy` / `outcome=succeeded|failed`

预览是独立分支：只有成功生成 canvas 预览才写 `share_preview_opened`。

### 邀请

1. URL 首次进入：`invite_banner_viewed` / `source=url`
2. 后续同设备可见：`invite_banner_viewed` / `source=storage`
3. 用户关闭提示：`invite_banner_dismissed`
4. 用户清除邀请记录：`invite_banner_cleared`

`dismissed` 与 `cleared` 不可互相替代：前者只隐藏当前邀请提示，后者删除本地邀请记录。

## 4. 实现与验证

- 纯事件层：`src/lib/growth-events.ts`
- 单元测试：`src/lib/growth-events.test.ts` 覆盖白名单、运行时枚举、额外字段剥离、日志抛错降级
- 组件测试覆盖三张分享卡、落地页下载、复制链接、CTA、邀请 banner 的真实触发路径

任何新增事件都必须先扩展判别联合与本文档，再补“只记录白名单字段”的测试。
