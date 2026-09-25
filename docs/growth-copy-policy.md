# 增长文案政策（R13.21：不引入暗黑模式）

> 范围：任何面向用户的增长 / 推广界面，包括 PWA 安装提示、邀请 banner、召回提示、
> 邮件订阅占位、分享卡与分享落地页 CTA。
> 执行：`npm run check:dark-pattern-copy`（已接入 CI）扫描
> `src/lib/growth-surfaces.json` 登记的所有表面。

## 为什么需要这条政策

Trade Buty 的内容宪法禁止收益承诺、荐股和券商导流（见 `docs/plan.md`）。同样的红线
必须延伸到「增长」这一层：如果靠倒计时、虚假稀缺、愧疚式挽留或伪造社会认同来拉新，
产品就变成了它一直反对的那种东西。本项目面向全球中文用户、以信任为差异化，因此把
「不做暗黑模式」从口头原则变成可回归的门禁。

## 硬性规则

| # | 规则 | 门禁实现 |
|---|---|---|
| 1 | 不得使用虚假紧迫（限时 / 倒计时 / 最后机会 / act now / last chance） | `BANNED_ZH` / `BANNED_EN` 文案扫描 |
| 2 | 不得使用虚假稀缺（仅剩 N 个名额 / limited spots / selling out） | 同上 |
| 3 | 不得使用愧疚式挽留（确定要放弃吗 / you'll regret it / don't walk away） | 同上 + `DISMISS_SHAMING` |
| 4 | 不得伪造社会认同（已有 N 人加入 / join 12,000 learners / everyone is） | 同上 |
| 5 | 声明 `blocking: false` 的表面不得用 `role="dialog"` / `aria-modal` 拦截正文 | `scanComponent` |
| 6 | 不得用 `setInterval` 制造倒计时，不得 `autoFocus` 抢焦点，不得默认勾选 | `scanComponent` |
| 7 | 声明 `requiresDismiss: true` 的表面必须给出双语、中性的关闭文案，且组件里真有可点关闭控件 | `dismissKeys` 校验 + `scanComponent` |
| 8 | 每个增长表面必须在 `growth-surfaces.json` 登记；名字像增长组件却没登记、也没写豁免原因的文件会让门禁失败 | `findUnregisteredGrowthComponents` |

## 表面登记表（唯一事实来源）

`src/lib/growth-surfaces.json` 记录每个表面的下面 11 个键——这一串不是举例，而是登记表
里出现过的全部键名；`scripts/growth-policy-claims.test.mjs` 拿它和 JSON 逐字比对，登记表
多一个键、少一个键都会红。

- `id`：这一条表面的主键；缺 id 或重复 id 让门禁失败。
- `kind`：表面类型（`pwa-install` / `referral` / `re-engagement` / `newsletter` / `sharing`）。
- `component`：实现文件，门禁会检查它真实存在且不含结构性暗黑模式。
- `i18nSection`：文案所在的字典 section，门禁会确认中英双语都存在，避免只做一半。
- `keyPrefix`：一个 section 里只有一小组键属于这个表面时，用它把扫描范围收窄到那一组（当前只有 `return-nudge` 用到）。
- `i18nSource`：文案不在默认字典 `src/lib/i18n.ts` 里时改指真正的字典文件（当前只有 `milestone-share` 用到，它的文案在 `src/lib/i18n-stats.ts`）。
- `requiresDismiss`：是否必须能关；声明为 `true` 的表面有 3 个。
- `dismissKeys`：关闭文案的键名，门禁会确认这些键在中英文典里都在。
- `blocking`：是否允许拦截正文；登记表中 7 个表面全部为 `false`。
- `optIn`：是否必须由用户主动触发；5 个为 `true`（安装、订阅、分享三类），2 个为 `false`（邀请 banner、召回提示）。**门禁不读这一项**，它只是登记事实。
- `notes`：这一条表面自己的边界说明。

不登记就上线的增长组件会在 CI 失败，这是有意为之：增长入口必须先回答「能不能关、
会不会拦内容、有没有诱导」三个问题。

## 关闭与选择权的具体约定

1. **安装提示**：只在浏览器发出 `beforeinstallprompt` 时出现；点「不再提示」或走完原生安装
   选择后写入本机标记，此后不再重复询问（见 `src/lib/install-prompt.ts` 与 R13.14）。
   那颗按钮写的就是它做的事：这台浏览器上的提示永久收起，所以它不叫「暂不」。
2. **邀请 banner**：被动出现、随时可关；另有「清除」入口删掉本机邀请状态（R8.5）。
3. **召回提示**：距上次访问满 7 天、且没超过 90 天才弹（超过 90 天算断签，那一次不弹）；
   同一个会话只弹一次，两次提示至少间隔 7 天。这两个数都在 `src/lib/last-visit.ts` 里
   （`RETURN_NUDGE_INTERVAL_MS` 与那条 90 天上限），由 `scripts/growth-policy-claims.test.mjs`
   现读比对，不在这里手抄。文案中性，不推销、不要挟、不发通知、不发邮件。
4. **邮件订阅**：明确标注是占位功能，邮箱只存本机，可清除、可导出（R8.8）。
5. **分享**：只在用户主动点击后生成，绝不自动分享、不用「转发解锁」之类的交换条件。

## 允许的表达

下面引号里的每一条都是中文界面里**真的印着**的原话（占位符 `{}` 照字典原文写），门禁会逐个
回 `src/lib/i18n.ts` 比对——先改文案，再来改这一节，别反过来：

- 陈述事实：「全部免费」「不荐股」「只讲知识」；
- 陈述进度：「你已读 {r} / {t} 篇」；
- 提供出口：「继续学习路线」「试试回放训练」「稍后再说」；
- 说明数据边界：「邮箱只存在这台浏览器，不上传」。

## 变更流程

1. 新增或修改增长表面 → 在 `growth-surfaces.json` 登记或更新条目；
2. 运行 `npm run check:dark-pattern-copy` 与相关组件单测；
3. 若确实需要出现黑名单词（例如引用某公司的反面案例），不要放宽全局黑名单，而是把该
   文案移出增长表面，或在本政策文档里单独论证并登记豁免；
4. 涉及埋点的改动同时遵守 `docs/growth-events.md` 与 `docs/growth-event-privacy-audit.md`。

## 验收证据

- `scripts/check-dark-pattern-copy.mjs`：静态门禁，覆盖 7 个登记表面与 4 条豁免、中英双语、
  组件结构；
- `scripts/check-dark-pattern-copy.test.mjs`：26 个用例，覆盖黑名单命中（中英各一路）、
  双语漂移、关闭文案缺失、阻断弹窗、倒计时/抢焦点/默认勾选、未登记组件与豁免清单、
  登记表自身缺 id / 重复 id / 组件文件不存在、字典块的引号-模板-注释边界，以及真实仓库回归；
- `scripts/growth-policy-claims.test.mjs`：本文档自己的说法门禁——上面这些数字、登记表
  的键清单、召回提示的两个天数、「允许的表达」里每一句引号，全部现读产物，不手抄；
- CI：`npm run check:dark-pattern-copy` 在 `.github/workflows/ci.yml` 中执行。
