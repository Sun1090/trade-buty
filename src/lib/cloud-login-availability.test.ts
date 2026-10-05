/**
 * 「云端登录可用」这件事只有一个判据，而且它必须与**真正发起请求的那道门**同源。
 *
 * R16.215：`getSupabaseBrowser()` 在缺 `NEXT_PUBLIC_SUPABASE_*` 的部署上**同步抛**，
 * 而登录页当时没有这道门禁 —— 于是访客点一次注定失败的按钮，拿到的是
 * 「发送失败，请稍后重试」。那是把**配置缺失**说成了**网络抖动**，会让部署方去查
 * 自己的网络，而重试永远不可能有用。
 *
 * 这条门禁钉两件事：
 * 1. 提问的那道门（`hasSupabaseEnv`）与回答的那道门（`getSupabaseBrowser` 的 env 判断）
 *    是**同一个判据**，不是各自写一遍；
 * 2. 页面与客户端组件都真的问了 —— 只在一处问，另一处就会重新开始承诺云端。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("云端登录可用性：判据唯一且两处都问了（R16.215）", () => {
  it("client 的 env 判断就是 env 模块那个判据，不是自己重写一遍", () => {
    const client = read("src/lib/supabase/client.ts");
    expect(client, "client 没复用 hasSupabaseEnv，改 env 判断就会漏到这里").toContain(
      "hasSupabaseEnv",
    );
    // client 抛错前必须真的问过判据，而不是见到 undefined 就抛
    expect(client).toMatch(/if\s*\(\s*!hasSupabaseEnv\(\)\s*\)/);
  });

  it("登录页与登录组件都问过这道门", () => {
    for (const rel of [
      "src/app/[locale]/auth/page.tsx",
      "src/components/login-client.tsx",
    ]) {
      expect(read(rel), `${rel} 没问 hasSupabaseEnv()`).toContain("hasSupabaseEnv");
    }
  });

  it("组件里既有可交互的门（按钮禁用）也有不可交互的早退（不去碰 supabase）", () => {
    const comp = read("src/components/login-client.tsx");
    expect(comp, "按钮没纳入 cloudReady —— 用户仍能点一次注定失败的按钮").toMatch(
      /buttonDisabled\s*=\s*[^;]*!cloudReady/,
    );
    expect(comp, "onSubmit 没有早退，少了纵深防御").toMatch(/if\s*\(\s*!cloudReady\s*\)\s*return/);
  });

  it("没配云端时不许显示「自动云端存档」那句承诺（subtitle）", () => {
    const page = read("src/app/[locale]/auth/page.tsx");
    expect(
      page,
      "subtitle 无条件渲染 —— 没配云端的部署上仍在承诺「登录后进度自动云端存档」",
    ).toMatch(/hasSupabaseEnv\(\)\s*&&\s*\(/);
  });
});
