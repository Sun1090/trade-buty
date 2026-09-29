import { test, expect, type Page } from "@playwright/test";

/**
 * 登录链路端到端验证（R16.235 落地的前置条件，此前一直缺失）。
 *
 * 这条链路改不得也验不得的状态持续了整个 R16.235 评估期：`npm run e2e` 跑在没有
 * Supabase env 的环境里，会话恢复 / onAuthStateChange / 登出从未被真正点过。
 * 本 spec 用本地 `supabase start` 栈（GoTrue + Mailpit）补上这一环：
 *
 *   1. `/zh/auth` 提交邮箱 → GoTrue 发 OTP 邮件进 Mailpit；
 *   2. 从 Mailpit API 取魔法链接 → 走 /auth/callback（PKCE code 交换）；
 *   3. 断言 header 进入登录态 → 刷新后会话仍在（getSession 恢复 + hydrateFromCloud）；
 *   4. 账户菜单退出登录 → 回到游客态。
 *
 * 运行条件：`supabase start`（supabase/config.toml，API 54341 / Mailpit 54344）+ 带
 * 本地 env 的构建与 `PW_REUSE_SERVER=1`。CI 没有 env，describe 级跳过——跳过是
 * 显式登记过的静默，不是忘了跑：门禁 `scripts/e2e-suite.test.mjs` 要求本文件登记进
 * package.json 的 e2e 脚本。
 *
 * 动作全部包进 `test.step` 且每个动作紧挨它自己的效果断言（R16.267 的「动作 + 效果
 * 成对」形状）：`page.goto` 默认等到 `load`，其余接管风险由成对断言兜住。
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const match = /^https?:\/\/(?:127\.0\.0\.1|localhost):(\d+)\/?$/.exec(SUPABASE_URL);
/** Mailpit 端口约定：API 端口 + 3（54341 → 54344），见 supabase/config.toml */
const MAILPIT_API = match ? `http://127.0.0.1:${Number(match[1]) + 3}/api/v1` : null;
const runLocally = match !== null && MAILPIT_API !== null;

test.describe("登录链路（本地 Supabase 栈）", () => {
  test.skip(!runLocally, "NEXT_PUBLIC_SUPABASE_URL 未指向本地 Supabase 栈（supabase start）——CI 与无 env 环境跳过");

  /** Mailpit 是本地一次性邮箱：同一封箱，按收件地址过滤消息 */
  async function findMagicLink(page: Page, email: string): Promise<string> {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const res = await page.request.get(`${MAILPIT_API}/search?query=${encodeURIComponent(email)}`);
      if (res.ok()) {
        const box = (await res.json()) as { messages?: { ID: string }[] };
        for (const msg of box.messages ?? []) {
          const detail = await (await page.request.get(`${MAILPIT_API}/message/${msg.ID}`)).json();
          const html = String((detail as { HTML?: string }).HTML ?? "");
          const rawLink = /href="(https?:\/\/[^"]+)"/.exec(html)?.[1];
          // 邮件 HTML 里的 & 是 &amp;：不解码，verify 端点收到的 type/redirect_to 全是坏的
          if (rawLink) return rawLink.replace(/&amp;/g, "&");
        }
      }
      await page.waitForTimeout(1000);
    }
    throw new Error(`30 秒内 Mailpit 里没等到 ${email} 的登录邮件`);
  }

  test("OTP 登录 → 会话恢复 → 退出登录", async ({ page }) => {
    const email = `e2e-${Date.now()}@trade-buty.test`;
    const accountButton = (emailEscaped: string) =>
      page.getByRole("button", { name: new RegExp(`账户: ${emailEscaped}`) });

    await test.step("提交邮箱，等发送成功横幅", async () => {
      await page.goto("/zh/auth");
      await page.getByRole("textbox").fill(email);
      await page.locator("form button[type=submit]").click();
    });
    await expect(page.getByText("登录链接已发送")).toBeVisible({ timeout: 15_000 });

    const magicLink = await findMagicLink(page, email);
    // 魔法链接指向本地 GoTrue verify 端点，会带 code 302 到 site_url 的 callback
    await page.goto(magicLink);

    // callback 交换完成后回跳首页，header 出现带邮箱 aria-label 的账户按钮
    await expect(accountButton(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).toBeVisible({
      timeout: 30_000,
    });

    // 会话恢复：刷新后 getSession 仍能拿到用户（auth-provider 的动态客户端 + getSession 路径）
    await test.step("刷新页面，会话仍在", async () => {
      await page.reload();
      await expect(accountButton(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).toBeVisible({
        timeout: 30_000,
      });
    });

    // 退出登录（auth-header 的动态 import signOut）
    await test.step("退出登录，回到游客态", async () => {
      await page.getByRole("button", { name: /^账户:/ }).click();
      await page.getByRole("menuitem", { name: "退出登录" }).click();
      await expect(page.getByRole("link", { name: "登录" })).toBeVisible({ timeout: 15_000 });
    });
  });
});
