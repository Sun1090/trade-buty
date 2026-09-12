# 增长事件隐私审计（R13.20）

最后更新：2026-09-12

## 0. 审计结论

**当前实现不构成远端数据收集，无需新增 cookie 同意或第三方数据处理协议。**

R13.19 的分享 / 邀请事件只在用户设备上调用 `console.info`。没有网络发送、
cookie、localStorage、sessionStorage、IndexedDB、剪贴板读取或广告标识符。
事件对象在进入日志前由 `normalizeGrowthEvent` 按判别联合重建；未知枚举被拒绝，
调用方传入的额外字段会被剥离。

这份审计是继续接入任何远端分析、错误监控或增长实验前置门槛。若未来改变出口、
新增字段、引入供应商或开始持久化，必须重新执行本文 §5 的评审并更新隐私政策。

## 1. 数据流

```text
用户操作
  -> 业务组件调用 trackGrowthEvent
  -> 运行时白名单 normalizeGrowthEvent
  -> safe 对象（仅枚举字段）
  -> console.info("[growth-event]", safe.name, safe)
  -> 浏览器开发者控制台（本机，未上传）
```

代码入口：`src/lib/growth-events.ts`。事件目录与漏斗口径：`docs/growth-events.md`。

## 2. 数据分类

| 字段 | 示例 | 分类 | 用途 | 结论 |
| --- | --- | --- | --- | --- |
| `name` | `share_card_download` | 产品事件枚举 | 区分漏斗步骤 | 保留 |
| `card` | `quiz` / `replay` / `streak` | 功能枚举 | 区分分享卡类型 | 保留 |
| `locale` | `zh` / `en` | 内容语言 | 区分内容语言 | 保留 |
| `surface` | `owner` / `landing` | 页面角色枚举 | 区分生成者与访客 | 保留 |
| `trigger` | `share` / `preview` | 交互枚举 | 区分下载入口 | 保留 |
| `outcome` | `started` / `succeeded` / `failed` | 状态枚举 | 观察可靠性 | 保留 |
| `destination` | `path` / `replay` | 目的地枚举 | 区分落地 CTA | 保留 |
| `source` | `url` / `storage` | 来源枚举 | 区分新邀请与本地既有邀请 | 保留 |
| 原始 `ref`、邮箱、账号 ID | 任意 | 身份 / 联系人数据 | 无 | **禁止** |
| 章节标题、课程 slug、文件路径 | 任意 | 可还原学习行为 | 无 | **禁止** |
| 完整 URL、query、分享 payload | 任意 | 可包含身份或内容 | 无 | **禁止** |
| 自由文本、答案、分数、币种周期 | 任意 | 内容 / 行为明细 | 无 | **禁止** |
| 设备指纹、精确时间戳、IP | 任意 | 在线标识 / 技术数据 | 无 | **禁止** |

`locale` 是受控枚举，不是浏览器语言指纹；`card`、`surface`、`trigger`、
`outcome`、`destination`、`source` 都是封闭集合。调用方无法通过类型或运行时
传入新的字符串值。

## 3. 存储、保留与跨境

- 应用层保留期：**0 秒**。本模块不写入任何持久存储。
- 浏览器控制台：日志由浏览器/开发者工具自行管理，刷新、关闭 devtools 或清空控制台即可移除；
  这不是本站可读取或导出的数据库。
- 跨境传输：无。日志没有离开用户的浏览器进程。
- 第三方供应商：无。当前没有 PostHog、Vercel Analytics、Sentry 或广告 SDK 接入该出口。

## 4. 威胁模型与已处理的攻击面

| 风险 | 处理 |
| --- | --- |
| 调用方意外附带 `ref`、邮箱、标题或 URL | `normalizeGrowthEvent` 重建 safe 对象，额外字段不进入日志 |
| 旧构建或手工调用发送未知事件 | 默认分支返回 `null`，不记录 |
| 非法 enum / 任意语言字符串 | 每类事件逐一校验，非法值整体拒绝 |
| 日志抛错阻断分享、下载、复制或邀请流程 | `trackGrowthEvent` 捕获全部异常；组件主流程不依赖它 |
| 事件模块被后续改成远端上报 | CI 运行 `npm run check:growth-event-privacy`，静态拒绝网络、持久化、cookie、剪贴板 API |
| 隐私政策与实现漂移 | 同一门禁检查中英文隐私页必须保留本机 console 披露文案 |

控制台本身可能被用户安装的扩展或浏览器调试功能观察，这属于用户设备上的本地环境，
不属于本站可控制的数据接收。远端遥测需要另做供应商、保留期、地区与同意机制评审。

## 5. 变更触发条件

出现以下任一情况时，R13.20 审计作废，必须重新评审：

1. 事件离开 `console.info` 出口，或引入 `fetch` / `sendBeacon` / 第三方 SDK；
2. 新增字段，尤其是原始 `ref`、账号、路径、自由文本、设备或网络标识；
3. 将事件写入 cookie、localStorage、sessionStorage、IndexedDB、服务端日志或数据仓库；
4. 引入供应商、广告、跨站追踪、用户画像、跨设备关联或自动化决策；
5. 隐私政策、适用地区法规或用户同意机制发生变化。

任何远端接入不得把本文件当作“已同意”结论；它只证明当前 console-only 版本的数据流。

## 6. 自动化验收

- `src/lib/growth-events.test.ts`：白名单、运行时枚举、PII 剥离、日志抛错降级。
- `scripts/growth-event-privacy.test.mjs`：审计器对网络 / 存储 / cookie / 剪贴板、
  未归一化日志、缺失事件目录和隐私页漂移的失败用例。
- `npm run check:growth-event-privacy`：CI 读取真实源码、事件目录与隐私页，验证
  console-only 出口、全部事件已登记及双语披露存在。

审计状态：**通过**（2026-09-12）。
