/**
 * R16.291：AI 路由的 5xx 标识串必须按**成因**分家，且永久性失败不许说「暂时」。
 *
 * 这一族此前只做过去重（`route.test.ts` 里的 R16.204 那一族管的是 4xx 标识串，
 * 5xx 一直没有同一个出处的约束），于是四个路由的八处 catch 手抄同一个值
 * 「AI 服务暂时不可用，请稍后再试。」，把两种**寿命完全相反**的失败说成了一种：
 *
 * - 鉴权不可用（缺 Supabase env、上游 Auth API 异常）：**永久**。部署不补配置，
 *   重试一万次是同一个结果，而那句话替它许了一个兑现不了的结局；
 * - 上游模型端点抽风：**真的暂时**，「请稍后再试」对它成立。
 *
 * 拆开之后要钉住的是三件事，任缺其一判据就会空转：
 * 1. **单一出处**：路由里不许再出现手写的 5xx 字面量（把某一处换回手抄即红）；
 * 2. **不许对永久故障承诺「稍后」**：直接断言 `authUnavailable` 这把键的文案里
 *    不含「暂时 / 稍后 / retry later」。这条是本判据的**主**判据——上面那条去重
 *    只需要常数自己长对，而把两个成因重新合并成一个值（等于回到旧状态）它也照样绿；
 * 3. **两种成因都真的在用**：只有 `authUnavailable` 在 plan/quiz 上有落点、
 *    只有 `upstreamUnavailable` 在 chat/summary 的上游 catch 上有落点，
 *    少用一个就说明「分家」只做了一半。
 *
 * 另有一条正交约束：`chat` 与 `summary` 的鉴权 catch 走**降级**（退化成游客桶继续服务），
 * 不许回 5xx——因为这两个端点的鉴权只用来挑限流桶，游客本来就能用。
 * 那两条路若有人改回 502，上面这三条全绿而这一条红。
 *
 * 形状与同族一致：扫带地板（路由数掉下来说明扫描坏了，不许报「0 违规」）、
 * 探测带正向对照（探测器必须抓得住一条已知违规，否则「0 违规」是空转）。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SERVER_ERRORS } from "../src/lib/ai/server-errors";

const root = process.cwd();
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

/** 四个 AI 路由：chat / plan / quiz / summary */
const ROUTES = ["chat", "plan", "quiz", "summary"];
const routePath = (n) => `src/app/api/ai/${n}/route.ts`;

/**
 * 把注释整块涂白，但保住行号（违规要报出第几行）。
 * 与 `e2e-wait-hygiene.test.mjs` 同一读法：`[ \t]*` 而不是 `\s*`，
 * 否则行首空白会连换行一起吃掉，涂白之后行号全漂一位。
 */
function blankComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

/**
 * 找出 5xx 响应里手写的错误文案。
 *
 * 只认两种会真的把字面量发出去的形状：
 * - `NextResponse.json({ error: "字面量" …`
 * - `new Response("字面量" …`
 * 取常量（`SERVER_ERRORS.x`）的写法不在射程内——那正是要推向的形状。
 * 排除注释，是为了不把上面那些解释「为什么这一处不该承诺稍后」的说明当成违规。
 *
 * **按同一次调用里的 status 判是不是 5xx**，而不是「所有 error 响应都算」。
 * 第一版漏了这一层：它把 `status: 413` 的 `BODY_ERRORS.tooLarge` 与那三个 `status: 400`
 * 也报成「手写了 5xx」，判据一跑出来就是红的——一个只会喊冤的判据没人会信。
 * 判 5xx 要看同一次调用里的 `status: 5xx`，跨行也算（`{ status: 502 }` 常写在下一行），
 * 所以这一层取的是**括号配平之后**的那段调用文本，而不是同一行。
 */
function handWritten5xx(source) {
  const code = blankComments(source);
  const literals = [];
  const lines = [];
  /** 取从 `from` 起括号配平的那段调用文本（调用体内没有括号字面量，粗略计数即可） */
  const callText = (from) => {
    let depth = 0;
    for (let i = from; i < code.length; i += 1) {
      if (code[i] === "(") depth += 1;
      else if (code[i] === ")") {
        depth -= 1;
        if (depth === 0) return code.slice(from, i + 1);
      }
    }
    return code.slice(from);
  };
  for (const re of [/NextResponse\.json\(/g, /new Response\(/g]) {
    for (const m of code.matchAll(re)) {
      const call = callText(m.index);
      if (!/status:\s*5\d\d/.test(call)) continue;
      const literal =
        /error:\s*["'`]([^"'`]+)["'`]/.exec(call) ??
        /^new Response\(\s*["'`]([^"'`]+)["'`]/.exec(call);
      if (!literal) continue;
      literals.push(literal[1]);
      lines.push(source.slice(0, m.index).split("\n").length);
    }
  }
  return { literals, lines };
}

/** 引用到的 SERVER_ERRORS 键 */
function serverErrorRefs(source) {
  return [...blankComments(source).matchAll(/SERVER_ERRORS\.([A-Za-z0-9_]+)/g)].map((m) => m[1]);
}

describe("AI 路由的 5xx 标识串：单一出处，且按成因分家（R16.291）", () => {
  it("扫描面没有被缩窄（四个路由都在，四条路线的源文件都存在）", () => {
    expect(ROUTES.length, "路由名单被改短了，下面几条判据的范围跟着变小却还是绿的").toBe(4);
    for (const n of ROUTES) {
      expect(read(routePath(n)).length, `src/app/api/ai/${n}/route.ts 不存在或为空——路径或后缀变了`).toBeGreaterThan(0);
    }
  });

  it("没有一处 5xx 手写字面量（都取自 SERVER_ERRORS）", () => {
    for (const n of ROUTES) {
      const { literals, lines } = handWritten5xx(read(routePath(n)));
      expect(
        literals,
        `src/app/api/ai/${n}/route.ts 这些行又手写了 5xx 文案：${lines.map((l, i) => `${l}「${literals[i]}」`).join(" ")}`,
      ).toEqual([]);
    }
  });

  it("正向对照：探测器抓得住退回手抄的写法（否则上面那条是空转）", () => {
    const fixture = 'return NextResponse.json({ error: "AI 服务暂时不可用，请稍后再试。" }, { status: 502 });';
    expect(handWritten5xx(fixture).literals, "探测器匹配不到手抄的 5xx 字面量").toEqual([
      "AI 服务暂时不可用，请稍后再试。",
    ]);
    // 取常量的写法必须不在射程内，否则真修好的代码会被自己判红
    expect(handWritten5xx('return NextResponse.json({ error: SERVER_ERRORS.authUnavailable }, { status: 502 });').literals)
        .toEqual([]);
    // `new Response("…")` 那一支也要咬得住——chat 的上游走的是它，不是 json
    expect(
      handWritten5xx('return new Response("AI 服务暂时不可用，请稍后再试。", { status: 502 });').literals,
      "探测器只认 NextResponse.json，chat 上游那一处退回手抄就躲过去了",
    ).toEqual(["AI 服务暂时不可用，请稍后再试。"]);
    // 4xx 不在射程内：413/400 那几个是 BODY_ERRORS。判据第一版漏了「按 status 判 5xx」这一层，
    // 于是对着 `BODY_ERRORS.tooLarge` 喊冤——一个只会喊冤的判据没人会信，这条是对那次的记念。
    expect(
      handWritten5xx('return NextResponse.json({ error: "Payload too large" }, { status: 413 });').literals,
      "把 4xx 误判成 5xx：判据会对着 BODY_ERRORS 喊冤",
    ).toEqual([]);
    // 注释里提一句不算违规（上面那份文件头的理由就写着这句话）
    expect(handWritten5xx('// 原本是「AI 服务暂时不可用，请稍后再试。」\nconst x = 1;\n').literals).toEqual([]);
  });

  it("主判据：永久性的鉴权失败不许承诺「稍后」（R16.291 要防的正是这一句）", () => {
    // 这一条不依赖任何路由源码：即使有人把两个成因重新合并成一个值（= 回到修复前的状态），
    // 只要那个值还带着「暂时 / 稍后」，这里就红。去重那条（上一条）单独管不住这个。
    expect(
      SERVER_ERRORS.authUnavailable,
      "authUnavailable 是永久性失败，措辞里出现「暂时 / 稍后」就是替配置问题许了一个兑现不了的结局",
    ).not.toMatch(/暂时|稍后|later|retry/i);
    // 反向：上游那把键**应该**带「稍后」——它是真暂时故障，删掉这句话反而成了不诚实
    expect(
      SERVER_ERRORS.upstreamUnavailable,
      "上游故障是真的暂时，措辞里「稍后重试」是承诺也是事实，去掉它等于把真暂时说成永久",
    ).toMatch(/稍后|retry|later/i);
    // 两者必须真的不同：合并成一个值就是分家失败
    expect(
      SERVER_ERRORS.authUnavailable,
      "两个成因共用同一个值 = 没分家",
    ).not.toBe(SERVER_ERRORS.upstreamUnavailable);
  });

  it("两种成因都有真实落点：authUnavailable 只在登录门禁的端点上，upstreamUnavailable 只在上游 catch 上", () => {
    const perRoute = new Map(ROUTES.map((n) => [n, serverErrorRefs(read(routePath(n)))]));
    const has = (n, key) => (perRoute.get(n) ?? []).includes(key);

    // plan / quiz 登录才可用（`if (!user) return 401`），身份不可信时不能放行成游客 → 5xx
    for (const n of ["plan", "quiz"]) {
      expect(has(n, "authUnavailable"), `${n} 是登录门禁端点，鉴权不可用时应当报 authUnavailable`).toBe(true);
    }
    // 上游 catch：每个路由都有
    for (const n of ROUTES) {
      expect(has(n, "upstreamUnavailable"), `${n} 的上游 catch 应当取 upstreamUnavailable`).toBe(true);
    }
    // chat / summary 的鉴权走降级，不许引用 authUnavailable（否则那句 5xx 又回来了）
    for (const n of ["chat", "summary"]) {
      expect(
        has(n, "authUnavailable"),
        `${n} 的鉴权只用来挑限流桶、游客本来就能用，走降级即可；这里出现 authUnavailable 说明它又改回 5xx 了`,
      ).toBe(false);
    }
    // 少引用一把键，说明「分家」只做了一半：常量里多出来的键没有任何路由用得上
    const allRefs = new Set(ROUTES.flatMap((n) => perRoute.get(n) ?? []));
    expect(
      [...Object.keys(SERVER_ERRORS)].filter((k) => !allRefs.has(k)),
      "SERVER_ERRORS 里有键没有任何路由引用——要么是多余的，要么是某个成因忘了落地",
    ).toEqual([]);
  });

  it("chat / summary 的鉴权 catch 走降级（不得回 5xx）", () => {
    for (const n of ["chat", "summary"]) {
      const code = blankComments(read(routePath(n)));
      // 取鉴权那几行：出现「auth unavailable」日志且把 user 置空，才算走了降级
      expect(code, `${n} 的鉴权 catch 里看不到降级日志`).toMatch(/auth unavailable, serving as guest/);
      expect(
        code,
        `${n} 降级之后必须把身份置空（user = null），否则还在按不可信身份分桶`,
      ).toMatch(/user = null/);
      // 降级分支里不许同时回一个 5xx：一边说「照常服务」一边又掐断，那不是降级
      const catchBlock = /catch \{[\s\S]{0,400}?auth unavailable, serving as guest[\s\S]{0,200}?\}/.exec(code);
      expect(catchBlock, `找不到 ${n} 的鉴权 catch 块`).toBeTruthy();
      expect(
        catchBlock[0],
        `${n} 的鉴权 catch 里既打降级日志又回 5xx——降级必须是「照常服务」，不能是「换个说法拒绝」`,
      ).not.toMatch(/status: 5\d\d/);
    }
  });
});
