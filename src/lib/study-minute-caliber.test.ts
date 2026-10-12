/**
 * 「台账秒数 → 分钟」只有一个算法：`src/lib/study-time.ts` 的 `studyMinutes`。
 *
 * 这句话原先写在 `weekly-summary.ts` 的 `weekMinutes` 头顶（R4.10），而同一本台账的
 * 秒→分钟在 `daily-goal.ts` 还长着第二份私有副本
 * （`Math.floor(getTodayStudySeconds().total / 60)`），`weekMinutes` 自己又是第三份。
 * 三份写法当时恰好等价，所以没有任何测试会红——真正的问题是改口径时只改得动一份：
 * R4.10 修的就是其中一份的取整方向（逐日取整再相加，把 30 秒的一天抬成「1 分钟」，
 * 于是同一页两张卡对同一段时间报「共学 7 分钟」和「共学 3 分钟」）。
 *
 * 判据盯的是**形状**而不是变量名：`Math.floor(` 的实参在最外层除以 60 就算命中，
 * 所以 `elapsed / 60`、`(a + b) / 60`、拆成三元再除都跑不掉。命中里允许两类合法住户：
 * 口径持有者自己，以及**语义不同**的秒→显示换算（见 `SEMANTIC_EXEMPTS`，逐条写理由）。
 * 豁免表是双向核对的：多一条（口径又扩散了）红，少一条（豁免对象已经不用了）也红。
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const OWNER = "src/lib/study-time.ts";

/** 旧写法长什么样：判据要先证明自己抓得住，否则「唯一口径」是句空话 */
const LEGACY_SHAPES: Array<[string, string]> = [
  ["私有副本：日目标读今日秒数", "  return Math.floor(getTodayStudySeconds().total / 60);"],
  ["私有副本：周摘要带容错", "  return Math.floor((Number.isFinite(totalSeconds) ? totalSeconds : 0) / 60);"],
  ["就地换算：整周求和后取整", "  const total = Math.floor(series.reduce((a, b) => a + b, 0) / 60);"],
  ["变量名不含 seconds 也照样命中", "  const m = Math.floor(rounded / 60);"],
];

/**
 * 口径持有者以外的合法命中，逐条点名并给出**为什么不算扩散**。
 * 共同点：它们的输入不是学习台账的去重秒数，输出的也不是「分钟数」这一个数，
 * 而是 `xh xm` / `mm:ss` 这类显示分段——把它们并进 `studyMinutes` 反而会把
 * 「不足一分钟算 0」的口径塞进计时器显示。
 */
const SEMANTIC_EXEMPTS: Record<string, string> = {
  "src/lib/reading-time.ts": "阅读时长格式化：秒 → `xh xm` 分段取整，不是台账分钟数（两处：分与时）",
  "src/components/quiz-timer.tsx": "测验计时器显示：秒 → `mm:ss`，与台账口径无关",
};

/**
 * 剥掉注释与字符串字面量，但**保持长度与换行**（命中处仍能按原文件算行号）。
 * 注释里点名的旧写法不是代码，字符串里的 `Math.floor(` 同理。
 */
function stripCommentsAndStrings(src: string): string {
  const out = src.split("");
  const blank = (from: number, to: number) => {
    for (let i = from; i < to && i < out.length; i++) {
      if (out[i] !== "\n") out[i] = " ";
    }
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      const end = src.indexOf("\n", i);
      blank(i, end < 0 ? src.length : end);
      i = end < 0 ? src.length : end;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end < 0 ? src.length : end + 2;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === "\\") {
          j += 2;
          continue;
        }
        if (src[j] === c) break;
        // 模板字面量里的 ${…} 可能嵌着真代码，保守起见不跨行吞
        if (c !== "`" && src[j] === "\n") break;
        j++;
      }
      blank(i, Math.min(j + 1, src.length));
      i = j + 1;
      continue;
    }
    i++;
  }
  return out.join("");
}

/** 源码里所有 `Math.floor(…)` 的实参（配到大括号闭合，支持任意嵌套深度） */
function floorArgs(src: string): { arg: string; index: number }[] {
  const code = stripCommentsAndStrings(src);
  const needle = "Math.floor(";
  const hits: { arg: string; index: number }[] = [];
  let i = 0;
  while ((i = code.indexOf(needle, i)) >= 0) {
    let depth = 1;
    let j = i + needle.length;
    for (; j < code.length && depth > 0; j++) {
      if (code[j] === "(") depth++;
      else if (code[j] === ")") depth--;
    }
    if (depth === 0) hits.push({ arg: code.slice(i + needle.length, j - 1).replace(/\s+/g, " ").trim(), index: i });
    i = j;
  }
  return hits;
}

/** 秒 → 分钟的取整：实参在**最外层**除以 60（`x / 60 % 1` 这种不算） */
const DIVIDES_BY_60 = /\/\s*60(?:\.0)?\s*$/;

function secondToMinuteSites(dir: string) {
  const files: string[] = [];
  const walk = (rel: string) => {
    for (const entry of fs.readdirSync(path.join(process.cwd(), rel), { withFileTypes: true })) {
      const child = path.posix.join(rel, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")) files.push(child);
    }
  };
  walk(dir);
  const sites: { rel: string; line: number; arg: string }[] = [];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
    for (const { arg, index } of floorArgs(src)) {
      if (DIVIDES_BY_60.test(arg)) {
        sites.push({ rel, line: src.slice(0, index).split("\n").length, arg });
      }
    }
  }
  return { files, sites };
}

const { files: FILES, sites: SITES } = secondToMinuteSites("src");
const line = (rel: string, n: number) => `${rel}:${n}`;

describe("学习台账秒数 → 分钟只有一个算法", () => {
  it("扫描面本身不能是空的，否则下面全是空转", () => {
    expect(FILES.length, "没扫到源码文件就是扫描器坏了").toBeGreaterThan(100);
    expect(FILES).toContain(OWNER);
  });

  /**
   * 光有「文件数 > 100」挡不住把扫描根缩小：`src/lib` 自己就有 124 份非测试源码，
   * 换成它之后那条地板照样不响，而组件侧的副本（`weekly-report.tsx` 那一处就是历史住户）
   * 从此没人看。所以扫描面要按**目录结构**核对：三类住户各在场，且总数贴近仓库真实规模。
   */
  it("扫描面覆盖 src 下每一类目录，缩小扫描根当场红", () => {
    for (const prefix of ["src/app/", "src/components/", "src/lib/"]) {
      const n = FILES.filter((rel) => rel.startsWith(prefix)).length;
      expect(n, `扫描面里 ${prefix} 只剩 ${n} 份，扫描根被缩小了（判据只看到一部分仓库）`).toBeGreaterThan(20);
    }
    expect(FILES.length, "扫描面远小于仓库非测试源码规模，多半是扫描根或排除规则被动过").toBeGreaterThan(200);
  });

  it("判据抓得住每一份被删掉的旧写法（非空转自证）", () => {
    expect(LEGACY_SHAPES.length, "旧写法样本本身不能太少").toBeGreaterThanOrEqual(4);
    for (const [name, src] of LEGACY_SHAPES) {
      const [hit] = floorArgs(src);
      expect(hit, `扫不到 Math.floor：${name}`).toBeDefined();
      expect(DIVIDES_BY_60.test(hit.arg), `判据抓不住旧写法：${name} → Math.floor(${hit.arg})`).toBe(true);
    }
  });

  it("判据不被注释和字符串骗到", () => {
    const commented = ['// Math.floor(elapsed / 60) 这种写法要收敛', "const s = 'Math.floor(x / 60)';"].join("\n");
    expect(floorArgs(commented), "注释与字符串里的 Math.floor 不该算命中").toEqual([]);
  });

  it("口径持有者自己恰好有一份实现", () => {
    const own = SITES.filter((s) => s.rel === OWNER);
    expect(own.map((s) => line(s.rel, s.line)), "studyMinutes 之外不许再算秒→分钟").toHaveLength(1);
    const ownerSrc = fs.readFileSync(path.join(process.cwd(), OWNER), "utf8");
    expect(ownerSrc).toContain("export function studyMinutes");
  });

  it("持有者以外的每一处秒→分钟都登记在豁免表里，且理由仍然成立", () => {
    const offenders = SITES.filter((s) => s.rel !== OWNER);
    const hitFiles = new Set(offenders.map((s) => s.rel));
    const unregistered = [...hitFiles].filter((rel) => !(rel in SEMANTIC_EXEMPTS));
    expect(unregistered, `新的秒→分钟私有副本没有登记理由：\n${unregistered.map((r) => line(r, 1)).join("\n")}`).toEqual([]);
    const stale = Object.keys(SEMANTIC_EXEMPTS).filter((rel) => !hitFiles.has(rel));
    expect(stale, `豁免表里有不再命中的条目，请删掉（留着它就是在给未来的副本让路）：\n${stale.join("\n")}`).toEqual([]);
    for (const [rel, reason] of Object.entries(SEMANTIC_EXEMPTS)) {
      expect(reason.length, `${rel} 的豁免理由不能是空话`).toBeGreaterThan(10);
    }
  });

  it("消费方一律走 studyMinutes，不许自己 import 台账再取整", () => {
    const users = FILES.filter(
      (rel) => rel !== OWNER && fs.readFileSync(path.join(process.cwd(), rel), "utf8").includes("studyMinutes"),
    );
    expect(users.length, "没有消费方 = 这条核对空转").toBeGreaterThan(1);
    for (const rel of users) {
      const src = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
      if (rel === OWNER) continue;
      expect(
        /import\s*\{[^}]*\bstudyMinutes\b[^}]*\}\s*from\s*"[^"]*study-time"/.test(src),
        `${rel} 用了 studyMinutes 却没从 study-time 导入（多半是又留了一份本地副本）`,
      ).toBe(true);
    }
  });

  it("旧名字 weekMinutes 不再作为第二入口存在", () => {
    // 别名本身无害，有害的是「两个名字一个实现」还互相指认对方是口径持有者。
    // 删掉别名后，柱状图、周度摘要、日目标三条读法都直接指向 studyMinutes。
    // 只看代码：持有者的注释里留着这个名字讲历史，那是必要的上下文。
    for (const rel of FILES) {
      const code = stripCommentsAndStrings(fs.readFileSync(path.join(process.cwd(), rel), "utf8"));
      expect(/\bweekMinutes\b/.test(code), `${rel} 仍在引用已被删除的 weekMinutes`).toBe(false);
    }
  });
});
