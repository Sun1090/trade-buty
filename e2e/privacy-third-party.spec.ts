/**
 * 隐私页「第三方服务」一节的说法，必须对得上浏览器真的发出去的跨源请求。
 *
 * 判据口径是**零点击**：打开路由、什么都不做，此刻离开设备的跨源请求与 WebSocket
 * 就是「用户没有主动使用任何功能」时的事实。原文写的是「每项服务仅在你主动使用
 * 对应功能时才被调用」，而首页的行情条一挂载就每 5 秒轮询 `api.binance.com`——
 * 那句话对首页这一条是假的。
 *
 * 两条判据都盯**关系**而不是抄数：观测到的主机名必须出现在**渲染后的**那一节里
 * （不是整页，R16.162 的教训：整页匹配等于没有射程），且自动发生那件事必须被明写。
 */
import { test, expect, type Page } from "@playwright/test";

/** 静置多久：首页轮询 5s 一次，留出一个完整周期再加余量 */
const IDLE_MS = 7_000;

/**
 * 观测面 = 所有「静态上能走到跨源模块」的页面（由 `scripts/privacy-ext-route-coverage.test.mjs`
 * 对着源码树核，不许手抄）。课文页那条是**懒加载**图表（`LazyChartEmbed` 视口门控），
 * 零点击时一个跨源请求都不发——所以它在清单里是「候选被观测过且确认无请求」，
 * 而不是「每条都必须命中」；地板因此是全局的，见下面第一条判据。
 */
const ROUTES = [
  "/zh",
  "/en",
  "/zh/chart",
  "/zh/replay",
  "/zh/knowledge/getting-started/candlestick-basics",
] as const;

/** 打开路由、什么都不做，收集这段时间里离开设备的跨源主机名 */
async function zeroClickHosts(
  page: Page,
  route: string,
  tally?: (n: number) => void,
): Promise<Set<string>> {
  const hosts = new Set<string>();
  let count = 0;
  const externalHost = (raw: string): string | null => {
    const host = new URL(raw).hostname;
    return host === "localhost" || host === "127.0.0.1" ? null : host;
  };
  page.on("request", (req) => {
    if (!externalHost(req.url())) return;
    count += 1;
    hosts.add(new URL(req.url()).hostname);
  });
  page.on("websocket", (sock) => {
    if (!externalHost(sock.url())) return;
    count += 1;
    hosts.add(new URL(sock.url()).hostname);
  });
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(IDLE_MS);
  tally?.(count);
  return hosts;
}

/** 渲染后某一语言的「第三方服务」一节正文（按该语言的节标题定位，不读整页） */
async function thirdPartySection(page: Page, locale: "zh" | "en"): Promise<string> {
  const heading = locale === "zh" ? "第三方服务" : "Third-Party Services";
  await page.goto(`/${locale}/privacy`, { waitUntil: "domcontentloaded" });
  const section = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: heading }) });
  await expect(section, `隐私页必须有「${heading}」这一节`).toHaveCount(1);
  return (await section.innerText()).toLowerCase();
}

test("零点击时打到的每一个跨源主机，隐私页那一节都点名了", async ({ page }) => {
  const hosts = new Set<string>();
  let observedRequests = 0;
  for (const route of ROUTES) {
    const set = await zeroClickHosts(page, route, (n) => {
      observedRequests += n;
    });
    for (const host of set) hosts.add(host);
  }
  // 地板是**全局**的：按路由要求每条都命中，会把懒加载页判成缺陷（课文页实测零跨源）。
  // 它挡的是「网络被整体挡掉于是整趟静默全绿」这一类空转。
  expect(observedRequests, "整趟观测到的跨源请求总数").toBeGreaterThan(0);
  expect(hosts.size, "观测到的跨源主机数").toBeGreaterThanOrEqual(2);

  // 两种语言各自核对：只在 zh 页面上查，等于默认英文文案永远不必提到这个主机名
  for (const locale of ["zh", "en"] as const) {
    const copy = await thirdPartySection(page, locale);
    for (const host of hosts) {
      expect(
        copy,
        `/${locale}/privacy 的第三方一节应点名 ${host}`,
      ).toContain(host.toLowerCase());
    }
  }
});

test("静置首页就会发生的联系，文案不许写成「仅在你主动使用时」", async ({ page }) => {
  const homepageHosts = await zeroClickHosts(page, "/zh");
  expect(homepageHosts.size, "首页零点击应当确实打出跨源请求").toBeGreaterThan(0);

  // 反向禁令 + 正向明写，逐语言各测一遍：把两种语言的形状混在一份文案上判，
  // 那条 en 禁令在 zh 页面上永远「通过」，是装饰而不是判据（本轮自己踩到后修）
  // 「自动」与「不需要你点」必须**同时**在场且成对出现：只写前者（或只写后者）的文案
  // 读起来仍然像在替一次静默的跨源联系打掩护，所以这里不用 `|` 放宽成二选一。
  const rules = [
    {
      locale: "zh" as const,
      forbidden: /仅在你主动使用对应功能时才被调用/,
      required: /自动发生[\s\S]*不需要你点/,
    },
    {
      locale: "en" as const,
      forbidden: /each service is contacted only when you use/i,
      required: /automatic[\s\S]*without you doing anything/i,
    },
  ];
  for (const { locale, forbidden, required } of rules) {
    const copy = await thirdPartySection(page, locale);
    expect(
      copy,
      `/${locale}/privacy 不许再用「每项服务仅在你主动使用时才调用」概括全部第三方`,
    ).not.toMatch(forbidden);
    expect(
      copy,
      `/${locale}/privacy 必须明写行情是自动发生的（零点击就会离开设备）`,
    ).toMatch(required);
  }
});
