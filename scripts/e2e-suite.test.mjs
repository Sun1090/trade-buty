import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * E2E 套件完整性门禁。
 *
 * `npm run e2e` 用**显式文件名列表**驱动 Playwright（不是 `playwright test e2e/`），
 * 好处是 CI 跑的是一份确定清单，不会因为新增目录文件而意外扩大范围。
 * 代价是：新增 `e2e/*.spec.ts` 时如果忘了把文件名加进脚本，这个 spec 既不会被
 * CI 跑到、也不会报错 —— 本地手跑全绿，流水线永远绿，属于最危险的静默失效。
 * 这里把「e2e/ 下的每个 spec 都必须被某个 e2e* 脚本登记」变成机检。
 */

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const e2eDir = "e2e";

/** e2e/ 目录下全部 spec（稳定排序） */
const actualSpecs = fs
  .readdirSync(e2eDir)
  .filter((file) => file.endsWith(".spec.ts"))
  .sort();

/** 从所有 e2e* 脚本里抽取被登记的文件名 → 脚本名 */
function scriptedSpecs() {
  const map = new Map();
  for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
    if (name !== "e2e" && !name.startsWith("e2e:")) continue;
    for (const match of String(command).matchAll(/e2e\/[\w.-]+\.spec\.ts/g)) {
      map.set(path.basename(match[0]), name);
    }
  }
  return map;
}

describe("E2E 套件完整性", () => {
  it("e2e/ 下每个 spec 都被 e2e 脚本登记", () => {
    const scripted = scriptedSpecs();
    const unregistered = actualSpecs.filter((file) => !scripted.has(file));
    expect(
      unregistered,
      `新增 spec 必须加进 package.json 的 e2e 或 e2e:* 脚本，否则 CI 静默不跑：${unregistered.join(", ")}`
    ).toEqual([]);
  });

  it("登记进脚本的 spec 文件都真实存在", () => {
    const missing = [...scriptedSpecs().keys()].filter(
      (file) => !fs.existsSync(path.join(e2eDir, file))
    );
    expect(missing, `脚本登记了不存在的 spec：${missing.join(", ")}`).toEqual([]);
  });

  it("视觉基线 spec 只走人工流程，不进 CI 的 e2e 套件", () => {
    // R7.8：toHaveScreenshot 基线受字体平台差异影响，只在 npm run e2e:visual
    // 人工复核，不进 CI。防的是有人图省事把 e2e 脚本换成 `playwright test e2e/`。
    const ciScript = String(pkg.scripts?.e2e ?? "");
    expect(ciScript).not.toContain("visual.spec.ts");
    expect(ciScript).toContain("smoke.spec.ts");
  });
});
