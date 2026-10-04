/**
 * R16.292：构建产物里的 manifest 分家断言——**这一半必须在 build 之后跑**。
 *
 * 与 `scripts/manifest-per-locale-claims.test.mjs` 是同一族判据的两半，拆开的原因写在
 * `check-bundle.mjs` 的调用点注释里：一句话是「CI 把 `test:coverage` 排在 `build` 之前，
 * 单元测试跑的时候还没有 `.next`」。第一版把两条产物判据写进单元测试，结果本地全绿、
 * CI 上 `ENOENT: .next/app-path-routes-manifest.json`——门禁把构建产物变成了单元测试的硬前置。
 *
 * 现在这半住在 `check:bundle` 里（它在 build 之后跑，`ci.yml` 第 131 行），半行单元测试都
 * 不用改时序；`scripts/manifest-per-locale-claims.test.mjs` 只留不依赖产物的那些断言。
 *
 * 纯函数、无副作用：返回 `false` 即失败，由调用方决定怎么退出。
 */
import fs from "node:fs";
import path from "node:path";

const LOCALES = ["zh", "en"];

/** SSG 首页落在 `.next/server/app/{locale}.html`（不是 `{locale}/index.html`）。 */
function builtHtml(appOut, locale) {
  for (const file of [
    path.join(appOut, `${locale}.html`),
    path.join(appOut, locale, "index.html"),
  ]) {
    if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  }
  return null;
}

export function checkManifestArtifacts({ appOut, root = process.cwd() }) {
  let ok = true;

  // ① 路由真的注册了。元数据文件那条路（`app/[locale]/manifest.ts`）在 Next 16 匹配不上，
  //    会被**静默忽略**——构建不报错、那个 URL 直接 404，所以必须从产物里点名要它。
  const routesManifest = path.join(root, ".next/app-path-routes-manifest.json");
  const routes = Object.values(JSON.parse(fs.readFileSync(routesManifest, "utf8"))).filter(
    (v) => typeof v === "string",
  );
  if (!routes.includes("/[locale]/manifest.webmanifest")) {
    console.error(
      "[bundle] ✗ 构建产物里没有 /[locale]/manifest.webmanifest：",
      "如果改成了 app/[locale]/manifest.ts，它在 Next 16 匹配不上元数据文件判定、会被静默忽略",
    );
    ok = false;
  }

  // ② 每种语言的页面上恰好一条 manifest link，且指向本语言那份。
  //    Next 会为 `app/manifest.ts` **自动**注入一条指向根级 `/manifest.webmanifest` 的 link，
  //    手写那条会与它并存成两条（产物实测确实是两条），而「多条 link 取哪一条」并无一致裁定。
  for (const locale of LOCALES) {
    const html = builtHtml(appOut, locale);
    if (!html) {
      console.error(`[bundle] ✗ 找不到 ${locale} 的构建产物 HTML（${locale}.html）`);
      ok = false;
      continue;
    }
    const links = [...html.matchAll(/<link[^>]*rel="manifest"[^>]*>/g)].map((m) => m[0]);
    if (links.length !== 1) {
      console.error(
        `[bundle] ✗ ${locale} 页面有 ${links.length} 条 manifest link（${links.join(" ")}）：`,
        "要改指向请走 generateMetadata 的 metadata.manifest（它会**覆盖** Next 自动注入的那条）",
      );
      ok = false;
    } else if (!links[0].includes(`href="/${locale}/manifest.webmanifest"`)) {
      console.error(`[bundle] ✗ ${locale} 页面的 manifest link 没指向本语言那份：${links[0]}`);
      ok = false;
    }
  }

  if (ok) {
    console.log(
      `[bundle] ✓ manifest 按语言分家：路由已注册，${LOCALES.length} 种语言各恰好一条 link 且指向本语言那份`,
    );
  }
  return ok;
}
