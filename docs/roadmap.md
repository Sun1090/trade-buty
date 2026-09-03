# Roadmap v0.2「账号与云端」（下一版本 · 共 150 项）

> 上一版本已关账：P0 骨架、P1 边学边练、双语、回放训练、测验/错题本地版、阅读工具链。
> v0.2 主题：账号体系 + 云端同步 + 离线 + 增長基建。任务按 Epic 分组，Epic 内按依赖顺序编号。
> 标记：`[keys]` 需 Supabase 线上密钥联调（代码可先写、mock 先测）。

## A. Supabase 基建与安全（A1–A15）

- [x] A1 接入 `@supabase/supabase-js` 与服务端/浏览器双客户端封装
- [x] A2 环境变量校验模块（缺 key 时构建期明确报错，不静默失败）
- [x] A3 `profiles` 表：user_id、display_name、created_at
- [x] A4 `progress` 表：user_id + 章节 slug + 课程 slug + completed_at（复合主键防重复）
- [x] A5 `quiz_results` 表：user_id + 章节 + 得分 + 用时 + taken_at
- [x] A6 `wrong_answers` 表：user_id + 章节 + 题号 + 错选 + resolved
- [x] A7 `replay_history` 表：user_id + 回放参数 + 成绩 + created_at
- [ ] A8 RLS 策略：所有表仅 owner 可读写（auth.uid() = user_id），逐条写策略测试
- [x] A9 SQL migration 文件纳入版本控制（supabase/migrations/）
- [ ] A10 本地 Supabase（supabase cli）一键起联调环境
- [x] A11 service_role 仅在 route handler 使用，客户端零引用已验证（A8 RLS 实测待 keys 联调）
- [ ] A12 数据库备份策略文档（Supabase 自动备份 + 导出演练）
- [ ] A13 表结构文档（docs/database.md，中英字段说明）
- [ ] A14 [keys] 线上建表 + RLS 逐条验证
- [ ] A15 [keys] 联调冒烟：读写删全链路通过

## B. 认证与会话（B1–B15）

- [ ] B1 Supabase Auth 邮箱魔法链接登录页（双语）
- [ ] B2 登录态全局 provider（session 刷新、过期处理）
- [ ] B3 导航栏登录/头像状态（未登录显示登录按钮）
- [ ] B4 受保护路由中间件（/review、云端页未登录跳转登录）
- [ ] B5 登录后回跳原页面（redirect 参数）
- [ ] B6 登出流程 + 清本地会话缓存
- [ ] B7 账号页：邮箱、注册时间、数据导出（JSON 下载）
- [ ] B8 账号页：删除账号（级联删云端数据 + 确认二次弹窗）
- [ ] B9 OAuth 登录（GitHub/Google 二选一先上）
- [ ] B10 登录页防滥用：限流提示、错误文案双语
- [ ] B11 未登录用户访问云端功能时的引导横幅（非阻断）
- [ ] B12 会话过期自动续期 + 失败降级为本地模式
- [ ] B13 认证相关 E2E（登录/登出/保护路由）
- [ ] B14 [keys] 生产环境 Auth 回调域名配置
- [ ] B15 [keys] 真机联调：注册→登录→登出一整遍

## C. 云端学习进度（C1–C15）

- [ ] C1 进度 API：POST /api/progress（幂等写入）
- [ ] C2 进度 API：GET /api/progress（分页 + 按章节聚合）
- [ ] C3 已读标记双写：localStorage 先行 + 后台同步队列
- [ ] C4 同步队列失败重试（指数退避，3 次后留本地待下次）
- [ ] C5 登录瞬间合并：本地进度上传（union 语义，去重）
- [ ] C6 多设备冲突规则文档（last-write-wins for timestamps, union for sets）
- [ ] C7 篇章页进度条数据源切换（登录走云端，未登录走本地）
- [ ] C8 首页「已完成 x/173」云端聚合
- [ ] C9 同步状态指示（已同步/同步中/离线本地模式小圆点）
- [ ] C10 旧数字键残留二次清理验证（storage-migrate 回归测试）
- [ ] C11 进度 API 限流与 body 校验（zod）
- [ ] C12 性能：GET 聚合查询 <200ms（索引检查）
- [ ] C13 进度相关单测（合并规则全分支覆盖）
- [ ] C14 [keys] 双设备联调（手机+电脑进度合并）
- [ ] C15 [keys] 断网→恢复同步演练

## D. 云端错题本与成绩（D1–D15）

- [ ] D1 错题 API：POST /api/wrong（记录）、PATCH（标记已掌握）、GET（列表）
- [ ] D2 本地错题首次登录全量上传
- [ ] D3 云端错题页复用现有 ReviewClient（数据源切换）
- [ ] D4 测验成绩 API：POST /api/quiz-result + 最佳成绩查询
- [ ] D5 小结卡成绩自动上传（失败静默）
- [ ] D6 答错解析页「加入收藏」扩展字段（note 备注）
- [ ] D7 成绩趋势迷你图（近 10 次正确率 sparkline，纯 SVG）
- [ ] D8 薄弱章节推荐（按错题分布算 top3，首页展示）
- [ ] D9 数据导出：错题 CSV 下载
- [ ] D10 API 输入校验 + 越权测试（只能读写自己数据）
- [ ] D11 单测：错题合并/去重/解决全分支
- [ ] D12 超大错题本分页（>100 题虚拟列表或分页）
- [ ] D13 [keys] 联调：答错→入库→另一设备可见→解决→同步消失
- [ ] D14 [keys] 并发写入压测（快速连答 20 题不丢）
- [ ] D15 [keys] RLS 越权负向测试（伪造 user_id 被拒）

## E. PWA 与离线（E1–E15）

- [ ] E1 manifest.json（双语 name、主题色、icons 192/512）
- [ ] E2 Service Worker：App Shell 预缓存（ser
...[truncated 6151 chars]