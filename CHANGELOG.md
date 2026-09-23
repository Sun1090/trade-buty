# 变更日志（CHANGELOG）

<!-- 由 `npm run changelog:generate` 从 src/data/release-notes.json 生成，请勿手工编辑。 -->

> 站点内的「更新日志」页面（`/[locale]/changelog`）与本文件共用同一份数据（`src/data/release-notes.json`）。
> v0.3 及更早的里程碑记录在 [docs/roadmap.md](docs/roadmap.md)。

## [0.7.14] - 2026-09-24

**把话说回到代码这一侧（第六批） / Making the copy match the code (round six)**

### 中文

- 「朗读」真的把整篇念完：过去整篇课文被截到 3000 字交给一条语音任务，而 182 篇里有 173 篇比它长（中位数 6,646 字）——念完那一截按钮就从「停止」退回「朗读」，界面把「这一截念完了」演成「整篇念完了」。现在按段落切成多条排队朗读，只有最后一条负责收尾，任何一条出错就把整队退回待命
- 16 条只写了中文一版的界面文案改按语言取值，判据也从「屏幕阅读器会念的属性」扩到人眼直接看到的按钮文字：英文访客从错题本下载的 .txt 曾经是一份中文表头，测验的「跳过」、课程分享卡上的三行同样不分语言。同时收拢出一份被两个组件各自抄了 18 个字段的答案字典
- 隐私页与 FAQ 改口：AI 反馈与引用点击不是「不含账户」——未登录时确实匿名，登录后每一行都带着账户标识写进库里；文案按实现的两种情形分别说明，并加一条扫描用例，让任何不带登录态限定的「不含账户」式说法无法再次出现
- AI 出错时不再把上游状态串摆到界面上：过去 401 的 Login required、429 的 Rate limit exceeded 会原样出现在中文页面里，现在 401 说「登录后可生成学习计划」、429 说清楚还要等几分钟，其余分支念本站自己的文案；生成失败后按钮也不再消失，可以直接重试
- 章节导语与课文摘要不再漏出 markdown 语法：这些短句是从原文里截出来的、不走链接改写那条通道，于是 [09-市场与品种专题篇/01-外汇市场.md](../…) 这种写法原样印在 22 个预渲染页面的可见文字上，两处还进了 <meta name="description">。内容仓原文一字未动，本侧收成语；路线页那一行数的其实是课文，量词却写着 chapters，一并改回 lessons
- 两处注释在替代码说话，如今按事实改写：合并摘要的 toast 写的是 5 秒自动消失、按用户去重，代码是 8 秒、按标签页且键里没有任何身份；聊天路由把「保留最近 10 轮」写成 10 组问答。篇章「已读几篇」也从四处各算各的收敛成一个出口——其中庆祝组件自己解析原始存储再取长度，字符串也有 .length，于是坏掉的一个值就能让「篇章完成！」的礼花在别处显示 0/2 时放出

### English

- Read aloud now reads the whole lesson: the text was cut to 3000 characters and handed to a single speech task, yet 173 of 182 lessons are longer than that (median 6,646) - and when that slice ended the button flipped back to Read aloud as though the lesson had finished. Lessons are now split by paragraph into a queue where only the last segment ends playback, and any failing segment returns the control to idle
- Sixteen interface strings that existed only in Chinese now follow the visitor's language, and the check behind them widened from attributes a screen reader announces to the button text people actually read: a wrong-book .txt downloaded by an English visitor used to arrive with Chinese column headers, and the quiz Skip button and course share card were the same. A 18-field answer dictionary copied into two components was folded back into one export
- The privacy page and FAQ changed their story: AI feedback and citation clicks are not "stored without an account" - they are anonymous while you are logged out, and every row is saved with your account identifier once you are logged in. The copy now describes both cases, and a scan test rejects any future unconditional "no account" phrasing that drops the login qualifier
- AI failures no longer put upstream status strings on the screen: Login required from a 401 and Rate limit exceeded from a 429 used to appear verbatim on Chinese pages. A 401 now says a plan needs a login, a 429 says how many minutes to wait, other branches use our own wording, and the generate button stays put so a failed attempt can simply be retried
- Chapter taglines and lesson summaries no longer leak markdown syntax: those short strings are cut out of the source text and never pass through the link rewriter, so a raw [09-…](../…) link was printed as visible copy on 22 prerendered pages and landed in two meta descriptions. The content repository was left untouched and the flattening happens here; the learning-path line counts lessons but was labelled chapters, now corrected
- Two comments were speaking for the code while the code said something else, and are now truthful: the merge-summary toast documented a 5 second per-user dismissal while it actually runs 8 seconds per browser tab with no identity in the key, and the chat route described 10 rounds as 10 exchanges. The per-chapter read count also collapsed from four independent calculations into one owner - one of them parsed raw storage itself and took .length, so a single malformed value could fire the Chapter complete confetti while every other surface still showed 0/2

参考：[docs/roadmap.md](docs/roadmap.md)

## [0.7.13] - 2026-09-23

**界面说法与本地账本边界（第五批） / UI claims and local-ledger boundaries (round five)**

### 中文

- 搜索页不再把「加载更多」走成死路：命中数说的是全部命中而不是当前这一页（23 条命中不再写成 20 条），篇章筛选移到分页之前——此前排在第 21 位之后的命中一旦选定篇章就永远翻不到，界面还会对着确实存在的结果说「该篇章暂无匹配」
- 换账号不再扫走答题账本：清镜像时按 tb-quiz- 前缀下手的旧判定会把没有云端对应表的 tb-quiz-attempts 一起删掉，测验分数趋势从此永久少一段且无从恢复，而那个文件的头部注释当时明说不会清这类本地记录
- 四句替过去说话的文案改口，并加门禁看住：英文覆盖早已补齐到 27 篇章 / 182 课，路径页却还写着「正在翻译中——27/27 章可用」，FAQ 与关于页跟着说同样的话；首页那颗连续徽章也只剩「🔥 3 天」，「连续学习」这个必填标签从来没被渲染出来
- 界面上的数字回到代码这一侧：首页那句完成语按组件真正检测的范围来说（它看的是整套 27 章，不是「主线」那一段），多设备冲突提示念的是检测到的分歧处数而不是落盘明细的条数（23 处不再说成 20 处），统计导出里两个名不副实的字段按 v1 → v2 的迁移通道改名
- 删掉一份没人读的收藏表：图表币对按钮一直在往浏览器本地写「最近使用的币对」，而全站唯一的读者是它自己那次读改写——界面上从来没有一处念过这份清单，连带两处把它当功能列出的说明一起订正

### English

- Search no longer turns Load more into a dead end: the result count reports all hits rather than the current page (23 hits are no longer written as 20), and chapter filtering now happens before paging - previously any hit past position 20 became unreachable once a chapter was picked, while the page insisted that chapter had no matches at all
- Switching accounts no longer sweeps away the answer ledger: the old prefix-based mirror reset deleted tb-quiz-attempts, which has no cloud table to restore it from, permanently shortening the quiz-score trend - and that file's header comment explicitly promised such local-only records were never cleared
- Four sentences still speaking for a finished phase were rewritten, with a gate to keep them honest: English coverage has long been complete at 27 chapters / 182 lessons, yet the learning path still read "translation in progress - 27/27 chapters available", with FAQ and About saying the same, and the home streak pill showed only "3 days" because its required Streak label was never rendered
- The numbers on screen moved back to the code side: the home completion line now states the range the component really checks (all 27 chapters, not the core段 alone), the multi-device conflict notice reports how many divergences were detected rather than how many rows were stored (23 no longer reads as 20), and two misnamed statistics-export fields were renamed through the v1 to v2 migration path
- A favorites store nobody reads is gone: the chart's symbol buttons had been writing recently used pairs to browser storage while the only reader was its own read-modify-write, and two documents listed that watchlist as an existing feature

参考：[docs/roadmap.md](docs/roadmap.md)

## [0.7.12] - 2026-09-23

**时间口径归一（回放与图表） / Time calibers made consistent (replay and charts)**

### 中文

- 自定义回放的截止日期输入改按本地日历取界：UTC+8 用户每天 00:00–08:00 不再被禁止选择今天，选中的那一天也不再被当成在 UTC 午夜提前收口——此前窗口会静默少掉当天后半段
- 图表横轴的时区位移收敛成单一常量，REST 与 WebSocket 两条路共用：此前两处各写一遍、而实时帧的断言根本没核对时间戳，口径一错开实时更新就不再覆盖最后一根 K 线
- 本地跑生产冒烟前先确认量的是当前构建：端口上驻留的上一次 next start 会让整轮结果失真（旧构建的缺陷算成本次的红、本次的缺陷藏成绿），现在标识对不上就直接失败且一条断言都不跑

### English

- The custom replay end date now reads the local calendar: users at UTC+8 are no longer blocked from picking today between 00:00 and 08:00, and the day you pick no longer closes early at UTC midnight, which silently dropped the back half of it
- The chart's timezone offset is now a single constant shared by the REST and WebSocket paths. It had been hand-copied twice while the live-frame assertion never checked the timestamp, so any drift meant a live update stopped overwriting the last candle
- Local production smoke now proves it measured the build you just made: a leftover next start on the port skews the entire run (an old build's defects get billed to this release, this release's defects read as green), so a BUILD_ID mismatch now exits 1 without running any assertion

参考：[docs/roadmap.md](docs/roadmap.md)

## [0.7.11] - 2026-09-23

**界面说法与门禁兑现（第四批） / UI claims and gates made real (round four)**

### 中文

- 「清空对话」不再只清屏幕：登录用户按下按钮会真的删掉云端那一整段历史（新增按身份校验、独立配额的删除端点），云端没删成会在界面上告诉你，而不是下次进页又整段回来
- 「继续生成」补出来的答案真的存进云端了：那一发原先发的是空问题，被端点判成畸形载荷后静默丢弃；现在续写带着这一轮的问题与来源入库，刷新后被截断的回答也仍然给出续写入口
- 冒烟断言的条数由代码说了算：加一条探针而不同步两份文档即失败，删掉一道流水线步骤却还留在门禁表里（幽灵登记）同样失败
- 手册转述的巡检参数逐条钉回代码常量——同义词词典组数、FAQ 聚类窗口与门槛、外链巡检的超时与重试次数；把句子改写成不含数字的措辞来绕过核对也判失败
- 重算型报告过期时，门禁直接说出去哪儿重算（此前只报「入库版本过期」，读者还得回门禁表顺藤摸是哪一份巡检器写的）

### English

- "Clear chat" no longer just clears the screen: for signed-in users it now really deletes that stored history through a new identity-checked, separately rate-limited endpoint, and a failed server-side delete is reported in the UI instead of the whole thread reappearing on the next visit
- Answers extended with "Keep going" are actually saved now: that request used to carry an empty question, which the endpoint rejected as a malformed payload and the client silently dropped. A continuation is now stored with its own question and sources, and a restored truncated answer still offers the continue affordance
- The smoke-test count is decided by the code: adding a probe without updating both documents fails the gate, and so does a step removed from the pipeline that is still listed as guarding the site
- Every inspection parameter the operations handbook restates is pinned back to its code constant - synonym group count, FAQ clustering window and thresholds, link-patrol timeout and retries - and rewording a sentence to dodge the comparison also fails
- When a recomputed report is stale, the gate now names the exact command to regenerate it, instead of leaving you to trace which checker wrote the file

参考：[docs/roadmap.md](docs/roadmap.md)

## [0.7.10] - 2026-09-23

**界面说法与门禁兑现（第三批） / UI claims and gates made real (round three)**

### 中文

- 课末与错题卡上的「问 AI」不再空手而归：有对话历史的登录用户点进去，问题会接在既有对话后真正发出、章节上下文照常生效；地址栏里的一次性参数随即抹掉，刷新不会重复提问、重复扣配额
- 界面文案的占位符代入钉进门禁：459 个预渲染页面的可见文本、placeholder / aria-label / title / alt 属性、标题与 description 家族 meta，以及 6 个路由水合后的 DOM，都不许残留未代入的模板；界面页进一步按「任何花括号都算泄漏」判，组件自建字典不再是网外
- 风险提示兜底从「源码里接了线」改为对构建产物逐页核对：418 页逐一比对，兜底块必须正好出现在上游缺块的那 14 页上，多一页少一页都判失败
- 入库的重算型报告必须等于 CI 当场重算的结果（新增 check:report-freshness）——此前台账停在旧数字上也能一路全绿
- 320px 移动端巡检真的覆盖中英两种语言，并且清单里每条路径必须真返回 200：原先混着一个根本不是页面的反馈路径，那条用例一直在量 404 页、永远不会红
- 贡献者的 cp .env.example .env.local 现在真的能跑：该文件入库，并与代码、环境变量文档三方对账，新增变量漏登记即失败
- 文案与文档回到事实：法律页「更新日期」改由 git 算出（取不到就不说）、FAQ 的服务器内容清单补齐崩溃诊断日志、断档恢复卡不再立 5 分钟门槛、趋势图空态读屏文案跟随真正选中的时间窗、更新日志页只列最近几版不再把所有历史烤进静态页、字典里没有渲染点的死词条被删除并上线死键门禁、AI system prompt 补上「不预测走势」让 AI 页那句承诺有约束撑着

### English

- The 'Ask AI' buttons at the end of a lesson and on the mistake cards no longer come back empty-handed: signed-in users with existing history now have their question appended to that conversation with the chapter context intact, and the one-shot URL parameters are consumed so a refresh cannot ask twice and burn quota
- Placeholder substitution is now gated: across 459 prerendered pages the visible text, placeholder / aria-label / title / alt attributes, the title and description-family meta tags, plus the hydrated DOM of 6 routes may not contain an unsubstituted template; interface pages additionally treat any brace token as a leak, so component-local dictionaries are no longer outside the net
- The risk-warning fallback is audited against build output page by page instead of trusting that it was wired up: all 418 pages compared, the fallback block must appear on exactly the 14 pages whose upstream content lacks one — one page more or fewer fails the gate
- Committed recomputed reports must equal what CI recomputes on the spot (new check:report-freshness) — previously a ledger frozen at an old number still passed everything
- The 320px mobile sweep really covers both languages now, and every path on its list must return 200: a feedback path that is not a page at all had been measuring the 404 template, a test that could never fail
- Contributors' cp .env.example .env.local finally works: the file is tracked, and it is reconciled three ways against the code and the environment variable docs, so a new variable left unregistered fails the gate
- Copy and docs back to fact: legal pages derive their 'last updated' date from git and stay silent when it cannot be read, the FAQ's server inventory adds the crash-diagnostic logs, the streak-recovery card drops its invented 5-minute threshold, the trend chart's empty-state screen reader text names the range actually selected, the changelog lists only recent releases instead of baking all history into static HTML, dictionary entries with no render site were deleted behind a zero-budget dead-key gate, and the AI system prompt now forbids predicting price direction so the AI page's promise has a constraint behind it

参考：[docs/roadmap.md](docs/roadmap.md)

## [0.7.9] - 2026-09-23

**界面说法回到代码事实（第二批） / UI claims back to code facts (round two)**

### 中文

- 行情标的清单收口到一处：FAQ 明确图表可以直接输入任意以 USDT 计价的币安现货交易对，回放与首页行情条各自覆盖哪些标的也分别说清
- 学习路径与图表页不再抄写篇章编号和名称（「三站式」「第 08 篇」「06 · 技术分析篇」），改在渲染时由知识库代入；图表页删掉写死的 BTCUSDT · 4H 角标
- 示例经济日历不再承诺「本周」，页面写出的日期窗口由数据本身算出；早已下线的假行情组件（手写 K 线标着真实交易对与 +12.6%）连同用例一起删除
- 等待时长类文案只保留代码算得出的数：行情条慢速提示代入真实轮询间隔，AI 出题不再承诺「约需 10 秒」
- 清理与加固：删掉两条只有自己的测试在读的死文案，回放随机历史窗口去掉从不生效的钳位并补上「确实随机」的用例，新手引导步序与文案钉上测试
- 更新日志页不再把所有历史版本一次性烤进静态 HTML：只列最近 8 版，页面那句「更早的 N 个版本完整记录在 CHANGELOG.md」里的 N 与窗口大小都由同一份发布记录算出——此前每发一版页面就长一截，0.7.9 自己就把这页顶破了 45KB 的体积预算

### English

- One source of truth for market symbols: the FAQ now states that the chart accepts any USDT-quoted Binance spot pair you type, and replay and the landing ticker each name their own scope
- The path and chart pages resolve chapter numbers and titles from the knowledge base at render time instead of copying 「三站式 / 第 08 篇 / 06 · 技术分析篇」, and the chart page's hardcoded BTCUSDT · 4H caption is gone
- The sample economic calendar no longer promises 'this week' — the date window it shows is computed from its own data — and the long-dead fake hero chart (hand-drawn candles labelled BTCUSDT, +12.6%) was deleted
- Wait-time copy now states only numbers the code guarantees: the ticker's slow-mode note uses the real poll interval, and AI quiz generation no longer claims 'about 10 seconds'
- Cleanup and hardening: two dictionary entries kept alive only by their own tests were removed, the replay history sampler lost a clamp that never fired and gained a real randomness test, and onboarding step labels are pinned to the flow order
- The changelog page no longer bakes every release into its static HTML: it lists the latest 8 versions, and the "earlier N releases are recorded in CHANGELOG.md" line derives N and the window from the same release record — the page used to grow with every release, and 0.7.9 itself pushed it past the 45KB budget

参考：[docs/roadmap.md](docs/roadmap.md)

## [0.7.8] - 2026-09-23

**离线写入不再静默丢失，五处界面数字回到代码这一侧 / Offline writes stop vanishing; five on-screen numbers now come from the code**

### 中文

- 离线的学习记录不再静默丢掉：写进云端失败的记录要排进离线队列，而队列的代码单独打成一个按需加载的包。如果这一页恰好没拿到那个包（首次加载就失败、断网后重试、或网站刚发布导致旧地址 404），排队这一步本身就会失败——那条记录既进不了队列，也再没人提起它。现在它会先留在内存里排队，等包能加载了（下一次写入，或网络恢复后的自动重放）再补进队列，同一去重与条数上限口径。诚实的边界是：这份内存缓冲只活在当前标签页，这期间关掉页面仍会丢那部分云端补传，你本机的学习数据不受影响。
- 回放训练里「前多少根是背景走势」跟着你选的难度变了：三档难度的背景根数分别是 50、30、15，而那行说明一直写着「前 30 根为背景走势，从第 31 根开始回放」——选「新手」或「挑战」时，屏幕上报的是中间档的数，连起点第几根也是错的。
- 行情图表的提示只说它真做了的事：网络较慢时那句「已切换为 180 根 K 线精简模式」在宽屏上是假的——根数由屏幕宽度决定，慢网真正关掉的是实时推送和「显示完整」入口。现在这句话只说暂停推送，而精简/完整视图里的 180 与 500 直接取本次真正请求的根数，文字与请求不可能再各说一套。
- 「回放历史仅保留最近 100 轮」现在是一个数：本机写入、云端合并、登录取数各写了一遍 100，三处可以各自保留不同的 100 轮，合并那一步还能把本机刚留下的几轮裁掉。收成同一个常量，并让隐私页的 90 天与 100 轮都从代码取值。
- 「导出我的数据」按钮把文件里真正有什么写清楚了：卡片此前声称「包含浏览器本机存储的全部条目」，而登录会话（访问/刷新令牌）这一族已经不再写入文件——于是一句假话。现在点名被剔掉的那一类，并说明文件里仍带着记录这份数据属于哪个账户的本机标识（这类文件常被下载、转发、贴进 issue）。另外，界面上五处「27 篇章」改为按知识库现算：知识库加一章之后，首页描述、AI 页副标题、学习路径、关于页和 FAQ 不会再留在昨天。

### English

- Offline study records stop vanishing silently: a cloud write that fails is supposed to queue for retry, and that queue lives in a lazily loaded chunk. When the page never got that chunk (it failed on first load, you're offline, or a fresh deploy 404s the old address), the enqueue itself failed — the record reached neither the queue nor anyone's attention. It now waits in an in-memory buffer and is handed to the queue as soon as the chunk loads again (next write, or the automatic replay after the network returns), with the same dedupe and cap rules. The honest limit: that buffer only lives in the current tab, so closing the page during that window still loses that part of the cloud backfill — your local study data is unaffected.
- The replay trainer's note about context candles now follows the difficulty you picked: the three tiers use 50, 30 and 15 context candles, but the line under the controls always read "First 30 candles are context; replay starts from #31" — wrong number and wrong start for Beginner and Challenge.
- Chart status notes only claim what the code actually does: on a slow connection the note promised "compact 180-candle mode is active", yet the candle count follows viewport width — what slow network really turns off is live updates and the full-view switch. The note now says only that, and the 180 / 500 in the compact and full view notes are the count actually requested, so text and request can no longer diverge.
- "Replay history keeps the latest 100 rounds" is now one number: local writes, cloud merge and the login fetch each carried their own literal 100, so the three could keep different sets of 100 and the merge step could trim rounds the device had just saved. It is a single shared constant now, and the privacy page's 90-day and 100-round figures are read from the code.
- The "Export my data" button says what the file actually contains: the card claimed "all local browser storage entries are included", but the sign-in session (access/refresh tokens) family is no longer written — making that false. The excluded category is now named, along with the local marker that says which account the data belongs to (these files get downloaded, forwarded and pasted into issues). Five places that hardcoded "27 chapters" now count the knowledge base at build time, so adding a chapter no longer leaves the landing page, AI page, learning path, about page and FAQ behind.

参考：[docs/progress.md](docs/progress.md)

## [0.7.7] - 2026-09-23

**数据导出不含登录凭证、隐私页补齐队列边界，分享面四处订正 / Exports without credentials, honest queue limits, four share-surface fixes**

### 中文

- 「导出我的数据」不再把登录凭证写进文件：Supabase 的会话（access/refresh token）本来就存在浏览器 localStorage 里，而导出是无差别遍历所有键，于是那份被鼓励下载、转发、贴进 issue 的 JSON 里躺着一张能直接接管账户的凭证。现在按 sb- 前缀整族剔除，并有断言盯着序列化结果里不能出现令牌片段
- 隐私政策补上三件它此前没写的事：离线写入队列只留 200 条、第 201 条会把最旧的一条挤掉且不再重试；在同一台设备上切换账户会把上一个账户尚未同步出去的队列直接清空；本机数据并非只存活于 localStorage——几个界面提示状态写在 sessionStorage。删除账户的清单也补齐了 AI 对话记录与最佳连胜两项
- 📤「分享我的成绩」真的分享：图片交给系统分享面板（手机上可直接发到微信/Telegram/相册），平台不收图片时才退回原来的下载行为。同一屏里写着「分享」却只做下载的按钮、以及只有埋点没有提示的落地页下载失败，一并改正
- 连续打卡分享卡不再画一张空的「近 7 天」日历：分享链接本来只带两个天数、不带逐日记录，此前它等于在「连续 12 天」正下方宣称这一周什么都没学。测验卡片的读屏文字也改用与图上一个算法（此前读屏念 66.7%、图上画 67%）
- 两处口径回到单一来源：游客配额提示里的次数上限改读服务端响应头（写死的「10 次」与真实上限是两份真相），生产冒烟把「AI 返回 502」拆成护栏段与模型段——护栏在调用上游之前就返回，它正常就说明缺的是上游配置而不是站内代码

### English

- The data export no longer contains login credentials: the Supabase session (access and refresh tokens) lives in browser localStorage, and the export walked every key indiscriminately - so the JSON users are encouraged to download, forward and paste into issue reports carried a token that can take over an account. The sb- key family is now excluded, with an assertion watching the serialized artifact for any token fragment
- The privacy policy now discloses three things it previously did not: the offline write queue holds 200 entries and a 201st silently evicts the oldest, which is never retried; switching accounts on the same device discards the previous account unsent queue outright; and local data is not localStorage-only - a few interface flags live in sessionStorage. The account-deletion list also gained AI conversations and best replay streak
- The share button now shares: the card image goes to the system share sheet (straight to WeChat, Telegram or Photos on mobile), falling back to the old download only where the platform will not accept the file. Buttons labelled share that merely downloaded a file, and a landing-page download failure that only reached analytics, are fixed as well
- The streak card no longer draws an empty "last 7 days" calendar - the share link carries two numbers and no day data, so the old card claimed nothing happened this week directly under "12 days in a row". The quiz card screen-reader text now uses the same rounding the image draws (it said 66.7% while the card showed 67%)
- Two numbers return to a single source: the guest quota hint reads the server response header instead of restating a hardcoded 10, and the production smoke test splits "AI returned 502" into a guardrail leg and a model leg - the guardrail replies before any upstream call, so a healthy one points at upstream config rather than site code

参考：[docs/progress.md](docs/progress.md)

## [0.7.6] - 2026-09-22

**首屏水合、进度封顶与隐私披露的缺陷修复 / Fixes for first-paint hydration, capped progress calibers, and privacy disclosures**

### 中文

- 首页与 AI 页的「随机内容」不再在首屏自相打架：每日心得与 AI 示例问题过去在服务器渲染时抽一次随机、浏览器接管后再抽一次，React 因此判定整棵子树不可信并推倒重建；现在静态首屏固定给确定的一条，随机只发生在挂载之后与你点「换一条心得」时
- 学习数据不再出现超过满额的数：篇章侧栏的 150% 进度、路线页「已读 12/7 课」、课文清单角标 12/7、随堂测「历史最佳 99/3」与雷达图 >100% 全部收口到同一个封顶口径（去重 + 按当前课数/题数封顶），首页完成计数与统计页「总进度」也共用同一份实现；知识库改课留下的旧记录仍在本机，只是不再被算成多读了课
- 中文读屏不再念英文：汉堡菜单、主题切换、语言切换、提示卡关闭与「换一条心得」等按钮的可访问名称改由字典提供；同时删掉首页改版遗留的 18 条死文案，其中还躺着一个已经不成立的「173 篇深度课程」
- 隐私政策与 FAQ 按代码真实行为重写：说清未登录时到底有哪两类请求离开浏览器（你主动使用的 AI 助学、匿名崩溃诊断）、AI 上游是「智谱 GLM → DeepSeek → SenseNova」按可用性降级的链路而不是单一供应商、给回答打分与点开引用会匿名写入数据库哪些字段、注销账户后 AI 引用记录会摘掉身份作为匿名行保留，以及登录后 Supabase 会话 cookie 的存在
- 门禁与工具链加固：22 条关键路由的水合健康检查 + 逐条点击页内按钮的交互面巡检进 CI（外部行情域不再制造假失败）；「注销即清空云端数据」升级为数据库级不变量测试（新表漏写 on delete 即红）；FAQ 候选报告加 k-匿名门槛，单人独条的用户原话不再被提交进公开仓库；文档里引用的 pgTAP 断言数与测试文件对账

### English

- The homepage and AI page no longer fight themselves on first paint: the daily tip and the AI example questions used to pick randomness during server render and again once the browser took over, so React declared the whole subtree untrusted and rebuilt it. The static first paint is now deterministic, and randomness happens only after mount and when you ask for another tip
- Learning numbers can no longer exceed their own maximum: the 150% chapter rail, "read 12/7 lessons" on the path page, the 12/7 lesson-list badge, "best 99/3" in the quiz card and radar axes above 100% all collapse onto one capped caliber (de-duplicate, cap at the lessons/questions that exist today), and the homepage counter shares the implementation with the stats "overall progress" card; stale records left by content revisions stay on your device, they just no longer count as extra lessons read
- Screen readers in Chinese no longer read English labels: the menu, theme, language, toast close and next-tip buttons get their accessible names from the dictionary, and 18 dead strings left over from the homepage redesign were deleted - including a "173 in-depth lessons" claim that stopped being true
- The privacy policy and FAQ now describe what the code actually does: which two kinds of request leave your browser before you log in (the AI tutor you choose to use, and the anonymous crash diagnostic), that the AI upstream is a fallback chain of Zhipu GLM - DeepSeek - SenseNova rather than one vendor, which fields an answer rating or citation click writes anonymously to the database, that citation clicks are detached from your identity and kept when you delete your account, and that Supabase stores a session cookie once you are logged in
- Gates and tooling hardened: a hydration health check over 22 key routes plus a click sweep over every button on the page now run in CI (the external market-data domain no longer manufactures false failures); "deleting an account clears the cloud" became a database-level invariant test (a new table without an ON DELETE turns it red); the FAQ candidate report gained a k-anonymity floor so one-person question text is never committed to a public repo; and pgTAP assertion counts cited in docs are checked against the test files

参考：[docs/progress.md](docs/progress.md)

## [0.7.5] - 2026-09-22

**统计口径、回放评级与分享界面文案的缺陷修复 / Fixes to stats caliber, replay grading, and share-screen wording**

### 中文

- 统计页的两张周卡片从此说同一个数：柱状摘要此前把每天的学习秒数各自四舍五入再相加，7 天各学 30 秒会被报成「共学 7 分钟」，而旁边的周度摘要按整周合计说是 3 分钟；现在统一为整周向下取整，半小时的一天也不再被写成「1 分钟」，30 秒的柱子不再画成满格
- 回放训练的「本轮小结」评级与同一块面板里的分享卡同一个口径：面板此前自己抄了一套阈值、漏掉「少于 3 次猜测样本不足、不给评级」的规则，于是 2/2 全对的一轮在面板上是 S、画到卡上却是 C
- 分享卡与分享落地页的按钮和状态提示不再只有英文：预览按钮改回字典里早就写好的「预览卡面」，落地页的下载按钮与状态行改为「下载卡面 PNG / 可以分享了 / 正在生成预览…」，复制链接失败与回放取数失败的提示也按页面语言显示
- 维护工具：生产冒烟脚本遇到传输层抖动（`fetch failed`、socket 挂断、超时）会重试到第 3 次并在结论里注明是第几次才连上，不再让一次网络抖动冒充站内回归；断言不满足与非传输层异常仍然一次定性

### English

- The two weekly cards on the stats page now agree. The bar summary used to round each day's seconds separately and add them up, so 30 seconds on each of 7 days was reported as "7 minutes studied" while the weekly summary next to it said 3 minutes. Both now floor the weekly total; half a minute no longer reads as "1 minute" and a 30-second bar is no longer drawn full height
- The replay trainer's round summary and the share card in the very same panel now use one grading rule. The summary had its own copy of the thresholds and missed the "fewer than 3 guesses is too small a sample to rate" guard, so a perfect 2/2 round showed S on the panel and C on the card
- Share cards and the share landing page are no longer English-only: the preview button now uses the localized "Preview card" label that was already in the dictionaries, the landing page download button and status line follow the page language, and the copy-link and market-data failure messages are localized too
- Tooling: the production smoke script now retries transport-level flakes (`fetch failed`, socket hangs, timeouts) up to three times and reports which attempt connected, so one network hiccup no longer masquerades as a site regression. Assertion failures and non-transport errors still fail on the first try

参考：[docs/progress.md](docs/progress.md)

## [0.7.4] - 2026-09-22

**学习数据展示口径、行情与本地状态的七个缺陷修复 / Seven fixes to learning-data display, market prices, and local state**

### 中文

- 复习页的「已过期」与统计导出的 `overdue` 从此是同一个数：回填出来的到期日是推断值、不是系统真正排过的复习计划，旧数据（R5 之前的条目、云端 `srs_due` 为空的行）不再被标成红色「过期 N 天」。「今日到期」仍按回填口径，旧课文照样出现在队列最前面
- 所有接收 JSON 的端点在读流阶段设字节上限：7 个 AI 端点此前直接 `req.json()`，而字段级上限要整包缓冲并解析完之后才生效，匿名请求体等于把内存放大的额度交给客户端决定。现在超限立刻断流返回 413，7 个端点与原本已有上限的 `/api/error-reports` 共用同一把有界读取，并由新门禁 `check:request-body-bounds` 防止回归
- 行情卡在轮询失败时把屏幕上的旧价格标成「上次数据」：`navigator.onLine` 仍为 true 而请求全部失败才是最常见的破网姿势，过去只有离线才标注，旧报价于是继续顶着「实时行情」的标题显示
- 统计页的近 7 天迷你条不再冻结在打开页面那一刻：日期窗口此前锁死，用户学完一节课，旁边的学习日历亮起、这根条不动。现在跟随记录更新，并把「哪几天有学习」写进无障碍名称——此前亮与灭只有颜色一个通道
- 课末测验卡不再产生服务端/客户端不一致的首屏：成绩存在 localStorage，此前在渲染期直接读取，预渲染的 HTML 写的是「开始测验」而客户端 hydration 时用户早已做过题。现在服务端快照固定为「无进度」，挂载后对齐，答完一套题卡片自己更新成「再测一次 · 最佳 n/total」
- 篇章完成庆祝只在刚读完的时间窗内触发：判定此前是「这次挂载读到的进度是满的」，于是几周后随便点开一篇已学完的篇章也会再放一次礼花，对着旧成就宣布刚完成；云端同步来、本机没有阅读记录的进度同样不再庆祝
- 后台标签里的课程页不再给没人读过的课累计学习时长：`visibilitychange` 只在切换时触发，组件在后台挂载时事件一次也不会来，计时器按「可见」继续累加并汇入近 90 天学习时长与每日目标

### English

- The review page's "overdue" count and the `overdue` field in the stats export now use one ruler: a backfilled due date is an inference, not a schedule the system actually set, so legacy entries (pre-R5 rows, cloud rows with an empty `srs_due`) no longer get a red "N days overdue" mark. "Due today" still honours the backfill, so old lessons stay at the front of the queue
- Every endpoint that accepts JSON now bounds the body while streaming it: seven AI routes used bare `req.json()`, and per-field caps only apply after the whole payload has been buffered and parsed, which handed anonymous requests a memory-amplification dial. Oversized bodies are now cancelled and answered with 413; those seven routes and `/api/error-reports`, which already had a cap, now share one bounded reader, and a new `check:request-body-bounds` gate keeps it from regressing
- The market card now labels stale prices as "last available data" when polling fails: `navigator.onLine` staying true while every request fails is the common way to lose a network, and only the offline path was labelled, so old quotes kept shipping under a "Live market" heading
- The 7-day mini bar on the stats page no longer freezes at the moment the page opened: its date window was memoised, so finishing a lesson lit up the activity calendar beside it while the bar stayed put. It now follows new records, and which days had study activity is written into an accessible name instead of being carried by colour alone
- The end-of-lesson quiz card no longer ships a first paint that contradicts itself: scores live in localStorage and were read during render, so prerendered HTML said "Start quiz" while hydration already knew better. The server snapshot is now fixed at "no progress", the client reconciles on mount, and the card updates itself after a run finishes
- Chapter completion is celebrated only inside a just-finished window: the test used to be "progress looked complete on this mount", which fired confetti at chapters completed weeks ago, and cloud-synced progress with no local reading record no longer celebrates either
- A lesson opened in a background tab no longer accrues study time nobody spent: `visibilitychange` only fires on a transition, so a component mounted while hidden never received one and kept crediting time to the 90-day totals and daily goal ring

参考：[docs/roadmap.md](docs/roadmap.md) · [docs/ops.md](docs/ops.md)

## [0.7.3] - 2026-09-22

**数据归属、学习口径与 AI 端点边界的一批修复 / Account ownership, learning-metric consistency, and AI endpoint boundaries**

### 中文

- 共享浏览器上的数据归属：换账号登录不再把上一个账号留在本机的学习镜像并进当前账号并以当前账号身份补传回云端（`tb-data-owner` 归属戳；被丢弃的都是云端有对应行的可恢复镜像，账号回来重新登录即可恢复，设备偏好不在内）。登出或换号后 AI 对话窗口一并清空，上一账号的问答不再留在屏幕上
- 断网时的写入不再静默消失：Supabase 客户端把错误吞成 `{data:null,error}`，此前的失败兜底分支永远进不去，那次写入直接被丢弃；现在会入队并在联网或下次登录时重放。同时「清空错题本」开始同步清云端——只删本地等于没删，下次登录整本会被拉回来
- 回放训练每轮只统计一次：云端 `recorded_at` 是服务器落库时刻，与本机完成时刻必然差一段网络延迟，过去每次登录本地历史翻倍、统计页轮数虚高；合并摘要里的「新增 N 轮回放」也改为只数合并真正带入的轮次，不再对着本地与云端完全相同的数据报新增
- 复习与统计口径对齐：错题本头部的「今日到期/已过期」与统计页、复习提醒卡统一走回填后的 SRS 计划，旧数据不再同时被算成今日到期并显示 1 天后；「总学习时长」改为「近 90 天学习时长」，台账也真正按日历窗口保留 90 天，与隐私页的承诺一致
- 内容红线的强制点补齐：AI 问答对荐股/收益承诺的输入护栏过去只看最后一条用户消息的前 500 个字符，而送进模型的是最近 10 轮——先问荐股再发一句「继续」，或在前面垫 501 个无关字都能绕过去；现在逐轮判定且不截断。上游课文 frontmatter 的 YAML 损坏时不再把 `---` 围栏渲染进正文
- AI 端点的配额与数据边界：对话历史返回最近 50 条（此前取的是最旧的 50 条）、保存端点纳入配额、聊天配额按账号而非 client IP 分桶、反馈与引用点击同样按账号分桶（同一 NAT 出口下不再互相锁死）、身份不可确定时按匿名行入库而不是把真实反馈丢掉、人工抽查导出端点改用 service_role 后第一次真能取到数据、命中缓存的截断回答重新能看到「继续生成」
- 离线兜底页不再把人困住：连接恢复时那一次自动重载可能抢在浏览器网络栈之前落地，被 service worker 又送回兜底页，而 `online` 事件已经用过、不会有第二次——本地实测三次里两次停在「已经联网的离线页」上出不来。现在改成同源 HEAD 探针探通之后才自动重载（失败按 500ms 起步退避、最多 6 次），开局就已在线的那一份文档也会自己探一次，并给 30 秒窗口内最多 3 次的自动重载预算，用完就提示手动点按钮
- 发布与验证：0.7.2 的四条生产冒烟判据首次逐条实测，并把这套断言固化为 `npm run ops:smoke-prod`（10 条只读断言 + 16 条契约用例，任一失败 exit 1）；新增 R15「数据归属与认证边界」与 R16「学习数据口径一致性」两轮盘点的结论与两项明确不擅自选边的决策项；269 个测试文件 / 2561 个用例，语句覆盖率 96.24% → 96.31%、分支 91.10% → 91.36%（阈值 84/77 未下调）

### English

- Data ownership on a shared browser: signing in as another account no longer merges the previous account's local study mirror into the current account and re-uploads it under the current identity (a `tb-data-owner` stamp; everything discarded has a cloud row and comes back when that account signs in again, and device preferences are untouched). The AI chat panel is also cleared when you sign out or switch accounts, so the previous account's conversation no longer stays on screen
- Writes made while offline no longer vanish silently: the Supabase client swallows errors into `{data:null,error}`, so the previous failure branch could never run and that write was simply dropped; it is now queued and replayed on reconnect or next sign-in. Clearing the wrong-answer notebook now also clears the cloud copy — deleting only the local one meant nothing was cleared, since the whole book came back on next sign-in
- Each replay round is counted once: the cloud `recorded_at` is the server insert time, inevitably a network delay away from the local completion time, so every sign-in used to double the local history and inflate the round count on the stats page. The merge summary's N new replay rounds now counts only the rounds the merge actually brings in, instead of reporting new rounds for data that is identical on both sides
- Review and stats now measure the same thing: the notebook header's due/overdue counts follow the backfilled SRS schedule like the stats page and the streak recovery card, so legacy entries are no longer both due today and shown as due in one day; Total study time became Study time (last 90 days), and the ledger now really keeps a 90-day calendar window, matching what the privacy page promises
- The content-constitution enforcement point is closed: the input guardrail against stock picks and profit promises only inspected the last user message's first 500 characters while the model receives the last ten turns — asking for a pick and then saying continue, or padding 501 irrelevant characters in front, both got through. It now checks every user turn without truncating. A lesson whose frontmatter YAML is broken no longer renders its own `---` fence into the body
- AI endpoint quotas and boundaries: conversation history returns the most recent 50 rounds (it used to return the oldest 50), the save endpoint is now quota'd, chat quota buckets by account rather than client IP, feedback and citation clicks are bucketed by account too (a shared NAT exit no longer locks users out of each other), an undeterminable identity now stores an anonymous row instead of throwing away a real feedback entry, the manual review export finally returns rows after moving to service_role, and a cached truncated answer shows the continue affordance again
- The offline page no longer strands people: the single reload fired on `online` can land before the browser's network stack is actually ready, so the service worker sends the navigation right back to the fallback page — and `online` has already been consumed, so nothing retries. Measured locally, two out of three recoveries left the user sitting on an offline page that already reported being online. Recovery now reloads only after a same-origin HEAD probe succeeds (backoff from 500ms, at most six attempts), a fallback document that loads while already online probes for itself, and at most three automatic reloads are allowed per 30-second window before the page asks you to press Retry
- Release and verification: the four production smoke assertions from 0.7.2 were finally run one by one and turned into `npm run ops:smoke-prod` (10 read-only assertions + 16 contract tests, exit 1 on any failure); two audit rounds, R15 data ownership / auth boundaries and R16 learning-metric consistency, record their findings including two items deliberately left to a product decision; 269 test files / 2561 tests, statement coverage 96.24% → 96.31% and branch coverage 91.10% → 91.36% with no thresholds lowered

参考：[docs/roadmap.md](docs/roadmap.md) · [docs/ops.md](docs/ops.md) · [docs/release-checklist.md](docs/release-checklist.md)

## [0.7.2] - 2026-09-22

**账号隔离修复与内容红线覆盖收口 / Account isolation fix and content red-line coverage**

### 中文

- 修复账号切换后的数据隔离：登出或换号时，上一个账号迟到的云端进度响应仍会写进当前账号的本地存储，造成串档；现在每一轮写入前都校验会话是否仍是发起请求的那个账号，过期响应直接丢弃
- 补齐两处内容红线缺口：上游课文缺少合规风险提示块时，课文页自动展示本地化兜底提示；根级 `/share/*` 分享落地页（测验成绩、回放战绩、连续打卡三类）此前完全没有风险提示且没有任何测试看守，现在与全站页脚使用同一句文案，并由 E2E 逐路由钉住（中英共 16 条断言）
- 发布完整性：新增 `check:release-tag` 门禁，除最新发布版本外每条发布记录都必须存在同名 `vX.Y.Z` tag（`0.4.0`–`0.7.0` 属门禁上线前的遗留，显式豁免而非回填，避免把过期提交推成生产部署）；`v0.7.1` 是本仓库第一个 tag
- 工作保全审计进 CI：提交既没进入 `main` 也不在任何远端分支、或 PR 被关闭而工作去向从未确认时，流水线直接失败；CI 模式下读不到 GitHub 同样判失败，不允许门禁静默变绿
- 测试确定性：新增时钟卫生门禁，`expect(...)` 里直接读墙钟（结果取决于机器此刻是几点、跑多快）即判失败，真实定时器未受控的清单落为报告；存量 5 处命中已清零
- 质量基线：265 个测试文件 / 2483 个用例，语句覆盖率 95.47% → 96.24%、分支 90.35% → 91.10%（阈值 84/77 未下调）；14 个内容报告在内容未变时不再产生纯日期 diff，发布流程固化为受 `check:docs` 断言的 `docs/release-checklist.md`

### English

- Fixed account isolation after switching users: a late cloud progress response from the previous account could still be written into the current account's local storage after signing out or switching, mixing two accounts' data. Every write now verifies the session is still the one that started the request, and stale responses are discarded
- Closed two content-constitution gaps: lesson pages now render a localized fallback risk notice when an upstream lesson lacks a compliant block, and the root-level `/share/*` landing pages (quiz score, replay result, study streak) — which previously carried no risk notice at all and no test guarding it — now use the same sentence as the site footer, pinned route by route in E2E (16 assertions across both languages)
- Release integrity: a new `check:release-tag` gate requires every published release to carry its `vX.Y.Z` tag, except the newest one (0.4.0–0.7.0 predate the gate and are explicitly exempted rather than back-tagged, which could promote stale commits to a production deploy); `v0.7.1` is this repository's first tag
- The work-preservation audit now runs in CI: the pipeline fails when a commit exists in neither `main` nor any remote branch, or when a pull request was closed with the fate of its work unconfirmed. In CI mode an unreachable GitHub API also fails the gate, so it can never go quietly green
- Test determinism: a new clock-hygiene gate fails any assertion that reads the wall clock inside `expect(...)` — results that depend on what time it is or how fast the machine ran — while uncontrolled real timers are listed as a report. All five existing hits are gone
- Quality baseline: 265 test files / 2483 tests, statement coverage 95.47% → 96.24% and branch 90.35% → 91.10% with no thresholds lowered; 14 generated reports no longer produce a date-only diff when their content is unchanged, and the release procedure is now a checklist that `check:docs` asserts step by step

参考：[docs/v0.7.2-release-review.md](docs/v0.7.2-release-review.md) · [docs/release-checklist.md](docs/release-checklist.md) · [docs/test-clock-hygiene.md](docs/test-clock-hygiene.md)

## [0.7.1] - 2026-09-22

**游客登录态修复与发布完整性 / Guest session fix and release integrity**

### 中文

- 修复游客无法使用 AI 问答的回归：没有 Supabase 会话 cookie 时身份读取被误判为「未知身份」并抛错，登录态与历史接口返回 500、AI 问答返回 502；现在无会话按游客处理，其余认证失败仍然 fail-closed，不进入模型与数据库读写
- 修复 AI 对话在损坏的引用响应头下把 JSON 解析异常原文当作错误文案展示；URL 自动提问补齐章节上下文，检索阈值上限收敛
- 修复同步与本地数据边界：忽略非法的云端合并时间戳、Supabase 客户端初始化失败时写入入队、容忍被污染的最近搜索记录、非法分享元数据的语言回退与回放战绩精度上限
- 修复知识库正文中裸 `.` 相对链接被改写成坏路由；测验学习时长不再依赖真实墙钟，消除 CI 随机红灯
- 发布完整性：package.json 版本号绑定最新发布版本（此前长期停在 0.1.0）并新增 check:docs 漂移门禁；依赖与 lockfile 工具链钉定 npm 10.9.4
- 质量基线：258 个测试文件 / 2383 个用例，语句覆盖率 95.47%、分支 90.35%，474 个静态页面、93 项 E2E 与数据库 RLS/回滚门禁全部通过

### English

- Fixed a regression that broke AI Q&A for signed-out visitors: a request without a Supabase session cookie was read as an unknown identity and threw, so the session and history endpoints returned 500 and AI chat returned 502. A missing session is now treated as a guest, while every other auth failure still fails closed and never reaches the model or the database
- Fixed AI chat surfacing a raw JSON parser message as the user-facing error when citation headers were malformed; auto-ask from the URL now carries its chapter context, and retrieval thresholds are bounded
- Fixed sync and local-data edges: invalid cloud merge timestamps are ignored, writes queue when the Supabase client fails to initialise, corrupt recent searches are tolerated, and invalid share metadata and replay accuracy totals fall back correctly
- Fixed a bare `.` relative link in knowledge-base markdown resolving to a broken route; quiz study-time recording no longer depends on the real wall clock, removing a random CI failure
- Release integrity: package.json version is now bound to the latest published release (it had been stuck at 0.1.0) with a new check:docs drift gate, and the dependency and lockfile toolchain is pinned to npm 10.9.4
- Quality baseline: 258 test files / 2383 tests, statements 95.47% and branches 90.35% coverage, with 474 static pages, 93 E2E checks and the database RLS/rollback gates all green

参考：[docs/v0.7.1-release-review.md](docs/v0.7.1-release-review.md)

## [0.7.0] - 2026-09-20

**稳定性、覆盖率与发布可靠性 / Stability, coverage, and release reliability**

### 中文

- 修复 AI 对话复制失败/反馈静默、邮件订阅虚假复制成功、AI 变体题固定 400、本地快照损坏与回放状态异常等问题
- 新增统一剪贴板助手与匿名 AI 写入端点限流，并补齐课程、图表、分享、登录、错题与离线队列的回归覆盖
- 回放分享评级恢复正确比例、回放训练器补回首轮战绩并拒绝非法难度状态；亮色主题对比度获得 axe 回归保护
- 工具链升级至 TypeScript 6.0.3，新增 lockfile 可复现门禁；当前基线为 254 个测试文件 / 2203 个用例，474 个静态页面和 93 项 E2E 全部通过

### English

- Fixed silent AI-answer copy failures, fake newsletter copy success, the AI variant-quiz 400 regression, corrupted local snapshots, and invalid replay state
- Added a shared clipboard helper, rate limits for anonymous AI write endpoints, and regression coverage for courses, charts, sharing, login, wrongbook, and offline queue paths
- Restored correct replay-share grading, recovered the replay trainer’s first round, rejected invalid difficulty state, and added axe contrast regressions for light theme
- Upgraded to TypeScript 6.0.3 and added a reproducible-lockfile gate; the current baseline passes 254 test files / 2203 tests, 474 static pages, and 93 E2E tests

参考：[docs/v0.7-release-review.md](docs/v0.7-release-review.md)

## [0.6.0] - 2026-09-12

**内容覆盖、AI 质量与学习留存 / Content coverage, AI quality, and learning retention**

### 中文

- 知识库中英双语 27 章 / 182 篇镜像对齐，搜索索引、sitemap、术语与描述质量门禁全部进 CI
- AI 出题补齐策略与难度档、跨批去重、引用绑定、成本缓存与离线 fixture 质量集
- 课程内 AI 入口：课末提问、划词解释、追问链、导读缓存与统一开关
- 学习留存：学习总览、完成率与成绩趋势、错题复习、回放时长、连续学习温和恢复与周报
- 分享卡与 OG 降级、320px 移动端回归、PWA 离线、结构化数据与增长事件隐私审计

### English

- Aligned 27 chapters / 182 bilingual knowledge-base lessons, with search index, sitemap, terminology, and description quality gates in CI
- AI quiz generation gained strategy and difficulty tiers, cross-batch dedupe, citation binding, cost caching, and an offline fixture quality set
- In-lesson AI entry points: lesson-end ask, term explainer, follow-up chain, summary cache, and a single feature switch
- Learning retention: learning overview, completion and score trends, wrongbook review, replay duration, gentle streak recovery, and weekly reports
- Share cards with OG fallback, 320px mobile regression, PWA offline, structured data, and a growth-event privacy audit

参考：[docs/v0.6-release-review.md](docs/v0.6-release-review.md)

## [0.5.0] - 2026-09-06

**账号、隐私与留存 / Accounts, privacy, and retention**

### 中文

- 登录回跳与会话恢复，登录后本地/云端进度合并并给出合并摘要
- 离线写队列与重放、同步失败降级与可诊断状态
- 隐私数据导出与账号注销（服务端删除 + 本机数据清理）
- 登录态独立分包，游客首屏不加载账号相关代码

### English

- Sign-in redirect and session recovery, plus local/cloud progress merge with a merge summary
- Offline write queue with replay, and degraded sync states that stay diagnosable
- Privacy data export and account deletion (server-side removal plus local cleanup)
- Account code ships in its own chunk so guests never download it

参考：[docs/roadmap.md](docs/roadmap.md)

## [0.4.0] - 2026-09-05

**AI 陪学产品化 / AI study companion**

### 中文

- AI 问答：流式回答、加载与错误分级、配额提示、敏感话题护栏与引用点击统计
- 章节出题覆盖 27 章，支持难度档、变体题与错题本打通
- 间隔重复复习（SRS）、每日目标、连续学习与周报
- 分享卡、新手引导、结构化数据与 404 推荐位

### English

- AI Q&A: streaming answers, staged loading and error states, quota hints, sensitive-topic guardrails, and citation click tracking
- Chapter quiz generation across all 27 chapters, with difficulty tiers, variant questions, and wrongbook integration
- Spaced repetition review, daily goals, streaks, and weekly reports
- Share cards, onboarding, structured data, and 404 recommendations

参考：[docs/roadmap.md](docs/roadmap.md)
