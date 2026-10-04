/**
 * R16.292：PWA manifest 按语言分家。
 *
 * 登记时的现象（R16.107）：`src/app/manifest.ts` 把 `lang: "zh-CN"`、`start_url: "/zh"`、
 * 名称与描述全钉死在中文，而 `layout.tsx` 的安装引导在 `/en` 上印英文文案——
 * 英文访客点「Install」，装到桌面上的是个中文应用，启动页还把他甩到 `/zh`。
 *
 * 判据钉四件事，每条都有它自己的失败方式：
 *
 * 1. **两份 manifest 的身份字段逐字相同**。`id`/`scope` 描述「哪个应用」，一旦两份不同，
 *    同一台设备上会并存两个 Trade Buty，卸载得删两个。这一条是「分家」的**边界**：
 *    入口分流，身份不分家。
 * 2. **每份的界面字段跟着语言走**。`lang`/`name`/`description`/`start_url` 四项在两份里
 *    必须不同——若有人把英文那份改回中文，这里红。
 * 3. **页面上恰好一条 manifest link，且指向本语言那份**。这条是本轮踩出来的：
 *    Next 会**自动**为 `app/manifest.ts` 注入一条指向根级 `/manifest.webmanifest` 的 link，
 *    手写 `<link rel="manifest">` 会与它并存成两条（产物实测确实是两条），
 *    而「多条 manifest link 取哪一条」并无一致裁定。所以判据按**构建产物里的 `<head>`**
 *    数条数，而不是只看源码里有没有写那条 link。
 * 4. **根级那份不许消失**。`e2e/metadata-routes.spec.ts` 与 `src/lib/pwa-offline.test.ts`
 *    都按 `/manifest.webmanifest` 断言；顺手把两处现在仍写「中文默认入口」的地方钉住，
 *    免得有人为了修英文那份把中文那份一起删了。
 *
 * 走 Route Handler 而不是 `app/[locale]/manifest.ts` 的原因记在那个文件的头注释里，
 * 这里补一条可执行的判据防它退回去：**构建产物里必须出现 `"/[locale]/manifest.webmanifest"`**。
 * 元数据文件那条路在 Next 16 匹配不上（正则锚在 app 根目录），文件会被静默忽略——
 * 一个「改了但什么都没发生」的写法，必须靠这条判据当场暴露。
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import rootManifest from "../src/app/manifest";
import { getDict } from "../src/lib/i18n";

/**
 * 路由 handler 用**动态 import**，不在文件头静态引。
 *
 * 这是被探针 M6 逼出来的：那一组把 `manifest.webmanifest/route.ts` 换成
 * `manifest.ts`（Next 16 会静默忽略的那条路）。头上一条静态 import 会在**加载期**
 * 就抛 "Cannot find module"——整个文件崩掉，输出里看不到任何一条断言的名字。
 * 那正是 R16.206 记过的坑：探针脚本把「非零退出」读成「测试抓到了」，而启动期崩溃
 * 与「门禁咬住了」是两回事。改成动态 import 后，那一组跑出来的失败会指名道姓地说
 * 「路由没注册 / handler 搬走了」，而不是一句模块解析错误。
 */
const ROUTE_MODULE = "../src/app/[locale]/manifest.webmanifest/route";
async function loadRouteHandler() {
  try {
    return (await import(/* @vite-ignore */ ROUTE_MODULE)).GET;
  } catch (cause) {
    throw new Error(
      `导入 ${ROUTE_MODULE} 失败（${cause instanceof Error ? cause.message : String(cause)}）。` +
        "如果 `src/app/[locale]/manifest.webmanifest/route.ts` 不在了，说明这份 manifest 的实现被搬走了——" +
        "注意 `app/[locale]/manifest.ts`（元数据文件那条路）在 Next 16 匹配不上，会被**静默忽略**，" +
        "所以「改回去」看起来没事、构建产物里其实没有这个路由。判据见下面「构建产物里真的注册了」那一条。",
    );
  }
}

const root = process.cwd();
const read = (rel) => readFileSync(path.join(root, rel), "utf8");
const LOCALES = ["zh", "en"];

/** 调真正的 Route Handler 拿 JSON，而不是复制一份构造逻辑——复制的那份会与实现漂开。 */
async function servedManifest(locale) {
  const GET = await loadRouteHandler();
  const res = await GET(new Request("https://example.test/manifest.webmanifest"), {
    params: Promise.resolve({ locale }),
  });
  expect(res.headers.get("content-type"), "manifest 的 content-type 不是 application/manifest+json").toContain(
    "application/manifest+json",
  );
  return JSON.parse(await res.text());
}

/** 构建产物里的 `<head>`——数 manifest link 只能从这里数，源码里看不见 Next 自动注入的那条。 */
function builtHead(locale) {
  // SSG 的首页落在 `.next/server/app/{locale}.html`（不是 `{locale}/index.html`）。
  for (const file of [
    path.join(root, ".next/server/app", `${locale}.html`),
    path.join(root, ".next/server/app", locale, "index.html"),
  ]) {
    if (existsSync(file)) return readFileSync(file, "utf8");
  }
  throw new Error(
    `找不到 ${locale} 的构建产物 HTML（试过 ${locale}.html 与 ${locale}/index.html）——先 npm run build。` +
      "这条判据量的是产物里真实发出的 link，源码里数不出来（Next 自动注入的那条不在任何源文件里）。",
  );
}

describe("PWA manifest 按语言分家（R16.292）", () => {
  it("两份的身份字段逐字相同——否则设备上会并存两个同名应用", async () => {
    const root_ = rootManifest();
    for (const locale of LOCALES) {
      const m = await servedManifest(locale);
      for (const key of ["id", "scope", "dir", "display", "background_color", "theme_color"]) {
        expect(
          m[key],
          `${locale} 那份的 ${key} 与根级不同：两份 ${key} 不一致会让浏览器把它们当成两个应用`,
        ).toBe(root_[key]);
      }
      expect(m.icons, `${locale} 那份的图标契约与根级不同（可安装性会退化）`).toEqual(root_.icons);
    }
  });

  it("界面字段跟着语言走：英文那份不许退回中文", async () => {
    const zh = await servedManifest("zh");
    const en = await servedManifest("en");

    expect(en.lang, "英文那份的 lang 不是 en").toBe("en");
    expect(zh.lang, "中文那份的 lang 不是 zh-CN").toBe("zh-CN");
    expect(en.start_url, "英文那份的启动页还把人甩到 /zh").toBe("/en");
    expect(zh.start_url, "中文那份的启动页不对").toBe("/zh");

    // name/description 取自字典：钉住「来自字典且两份不同」，不把文案抄第二份。
    // 文案本身要过内容宪法，所以只断言「英文那份不含中文」而不是逐字对。
    expect(en.name, "英文那份的名字与中文那份相同——装出来还是中文应用").not.toBe(zh.name);
    expect(en.description, "英文那份的描述与中文那份相同").not.toBe(zh.description);
    expect(en.name, "英文那份的名字里出现中文").not.toMatch(/[一-鿿]/);
    expect(en.description, "英文那份的描述里出现中文").not.toMatch(/[一-鿿]/);
    // 且确实是字典里的值（防止有人把这两条从字典里删掉改成硬编码，check:dead-copy 之外再加一道）
    expect(en.name).toBe(getDict("en").appName);
    expect(en.description).toBe(getDict("en").appDescription);
  });

  it("未知语言退回默认语言，而不是抛错或产出空 manifest", async () => {
    // `[locale]` 之外的路径由代理兜住，但这条 handler 自己不该在拿到脏参数时崩掉：
    // 崩掉的表现是 500 而不是「退回默认那份」。
    const m = await servedManifest("de");
    expect(m.lang, "未知语言没有退回默认语言").toBe("en");
    expect(m.start_url).toBe("/en");
    expect(m.name, "未知语言产出的 manifest 没有名字").toBeTruthy();
  });

  it("构建产物里 `/{locale}/manifest.webmanifest` 这个路由真的注册了", () => {
    // 这条专防「改成元数据文件那条路」：Next 16 判定元数据文件的正则锚在 app 根目录，
    // `app/[locale]/manifest.ts` 匹配不上，会被静默忽略——源码改得很像样，构建产物里什么都没有。
    const raw = read(".next/app-path-routes-manifest.json");
    const routes = Object.values(JSON.parse(raw)).filter((v) => typeof v === "string");
    expect(
      routes,
      "构建产物里没有 /[locale]/manifest.webmanifest——如果改成了 app/[locale]/manifest.ts，" +
        "它在 Next 16 匹配不上元数据文件判定，会被静默忽略（实测 `/zh/manifest.webmanifest` 直接 404）",
    ).toContain("/[locale]/manifest.webmanifest");
  });

  it("每种语言的页面上恰好一条 manifest link，且指向本语言那份", () => {
    for (const locale of LOCALES) {
      const html = builtHead(locale);
      const links = [...html.matchAll(/<link[^>]*rel="manifest"[^>]*>/g)].map((m) => m[0]);
      expect(
        links.length,
        `${locale} 页面上有 ${links.length} 条 manifest link（${links.join(" ")}）：` +
          "Next 会为 app/manifest.ts 自动注入一条，手写 <link rel=\"manifest\"> 会与它并存成两条，" +
          "而多条 link 取哪一条并无一致裁定——要改指向请走 metadata.manifest（见 layout 的 generateMetadata）",
      ).toBe(1);
      expect(links[0], `${locale} 页面的 manifest link 没指向本语言那份`).toContain(
        `href="/${locale}/manifest.webmanifest"`,
      );
    }
  });

  it("根级那份仍在，且继续服务中文默认入口（e2e 与 pwa-offline 两处都按这个路径断言）", () => {
    expect(readdirSync(path.join(root, "src/app")).some((f) => f.startsWith("manifest."))).toBe(true);
    expect(rootManifest().start_url, "根级 manifest 的 start_url 不是中文默认入口").toBe("/zh");
    expect(rootManifest().lang, "根级 manifest 的 lang 不再是 zh-CN").toBe("zh-CN");
  });
});
