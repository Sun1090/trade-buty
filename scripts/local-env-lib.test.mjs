/**
 * R16.335：判据量的是「用过 vercel CLI 之后脚本还能不能跑」，不是「解析器能不能读到键名」。
 *
 * 旧的手搓正则 `^([A-Z_]+)=(.*)$` 能读到键名，所以任何只看键名的测试都会绿——
 * 它读到的值是 `"https://…"`（带字面双引号），拼进请求 URL 才炸。
 * 所以这里的断言全部打在**值**上。
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadLocalEnv } from "./local-env-lib.mjs";

const dir = mkdtempSync(path.join(os.tmpdir(), "tb-env-"));
const envFile = (name, body) => {
  const p = path.join(dir, name);
  writeFileSync(p, body, "utf8");
  return p;
};

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("脚本读 .env.local 只有一条路（内置 process.loadEnvFile）", () => {
  it("带双引号的值被剥掉引号——这正是 vercel CLI 写进来的形状", () => {
    const file = envFile(
      "quoted.env",
      'TB_PROBE_URL="https://example.supabase.co"\nTB_PROBE_PADDED="  padded  "\n',
    );
    loadLocalEnv(file);
    // 旧解析器会给出 `"https://example.supabase.co"`（含引号），拼进 URL 就是坏请求
    expect(process.env.TB_PROBE_URL).toBe("https://example.supabase.co");
    // 引号内的空白被保留：剥的是包裹的那一对引号，不是内容
    expect(process.env.TB_PROBE_PADDED).toBe("  padded  ");
  });

  it("单引号同样剥掉，值里的等号不被误切", () => {
    const file = envFile("tricky.env", "TB_PROBE_A='single quoted'\nTB_PROBE_B=has=equals\n");
    loadLocalEnv(file);
    expect(process.env.TB_PROBE_A).toBe("single quoted");
    expect(process.env.TB_PROBE_B).toBe("has=equals");
  });

  /**
   * 本轮改动**引入的一处行为差异**，显式钉住而不是留成暗雷：
   * 未加引号的值里出现 `#` 时，内置解析器按 dotenv 语义把它当行内注释切掉，
   * 旧的手搓正则则保留整串。取内置语义，因为它与 Next.js 运行时读 env 的口径一致
   * （`KEY=a#b` 在 next dev / build 里本来就是 `a`）——旧写法才是那个不一致的。
   * 真要保留 `#` 就加引号，这也是加引号的本意。
   */
  it("未加引号的 # 按 dotenv 语义是行内注释；要保留就得加引号", () => {
    const file = envFile("hash.env", 'TB_PROBE_RAW=a#b\nTB_PROBE_QUOTED="a#b"\n');
    loadLocalEnv(file);
    expect(process.env.TB_PROBE_RAW).toBe("a");
    expect(process.env.TB_PROBE_QUOTED).toBe("a#b");
  });

  it("已有环境变量不被文件覆盖（与旧手搓版同语义）", () => {
    process.env.TB_PROBE_PRESET = "from-process";
    const file = envFile("preset.env", 'TB_PROBE_PRESET="from-file"\n');
    loadLocalEnv(file);
    expect(process.env.TB_PROBE_PRESET).toBe("from-process");
  });

  it("文件不存在不抛，可选印一行说明并返回 false", () => {
    const printed = [];
    expect(
      loadLocalEnv(path.join(dir, "definitely-missing.env"), {
        log: (m) => printed.push(m),
      }),
    ).toBe(false);
    expect(printed.join(" ")).toContain("依赖已有环境变量");
  });

  it("正向对照：同一份夹具，旧的手搓正则确实读到带引号的值（自证病灶为真）", () => {
    // 这条不是装饰：它钉住「病灶存在」这件事本身。若哪天有人说
    // 「旧写法其实没问题」，这条会给出反证。
    const line = 'TB_PROBE_OLD="https://example.supabase.co"';
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    expect(m).toBeTruthy();
    expect(m[1]).toBe("TB_PROBE_OLD"); // 键名读得到——只看键名的测试因此会绿
    expect(m[2]).toBe('"https://example.supabase.co"'); // 值带引号：这才是真病灶
  });
});
