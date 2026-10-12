/**
 * R16.317：注释里点名的仓库路径必须存在——纯判定部分。
 *
 * 病灶（本轮实测）：源码注释会写「这条正则与 `rewriteLinks`（src/lib/kb-links.ts）是一对契约」，
 * 而 `src/lib/kb-links.ts` **从来没有存在过**（`git log --all` 对这个名字零历史），
 * 真实的主人是 `src/lib/content.ts`。同一轮量出四处这样的引用，全部指向从未存在的路径：
 * 读注释的人按它去找主人，找不到，于是要么放弃核对、要么在错的文件里改。
 *
 * 为什么这条值得单独成门禁而不是靠人眼：本仓已经给 `docs/roadmap.md` 的未决条目立了
 * 同型判据（`roadmap-open-reference-claims.test.mjs`：点名的路径必须存在、不许用会漂移的行号），
 * 但**源码注释**这一侧从来没有人管过。注释是代码里唯一没有类型、没有测试、改错了也不会红的部分，
 * 而它恰恰是下一个人找主人的第一手依据（R16.44 / R16.56 修的就是两处说反话的注释）。
 *
 * 判据的三条收窄都是**可判定的形状**，不是手抄清单：
 *   1. 只认注释行（`//`、`/*`、逐行 `*`），代码里的字符串字面量是数据不是引用；
 *   2. 路径若被引号紧邻包裹（`"docs/x.md"`），那是「代码长这样」的示例，不是仓库引用；
 *   3. `node_modules/…` 按依赖包根核对；其余路径在**本站与内容子模块两个根**下各试一次
 *      （注释里 `kline-buty \`scripts/kb-anchor-check.mjs\`` 与 `docs/plan.md` 常常同框，
 *      按整行改根会把后者判成失效引用）。
 *   4. 日期模板与通配写法（`docs/kb-changelog-YYYY-MM-DD.md`）在抽取阶段就滤掉——
 *      它们不是一个具体引用，计进分母会让扫描地板量到假数量。
 */

/** 注释行：行首 `//`、块注释开头，或块注释续行的 `*`。 */
const COMMENT_LINE = /^\s*(?:(?:\/\/|\/\*)|\*)/;

/**
 * 仓库路径形状。`node_modules` 也在前缀里：注释确实会点到依赖包内的文件（见 `resolveRef`
 * 给它单独的根）。前视排掉 `x/src/...` 这类没有边界的片段，后视排掉 `foo.jsonl` 里的截断。
 * 扩展名分支按长度降序，否则 `.json` 会被 `.js` 截断成假的 `x.js`——普查第一版就栽在这里，
 * 一下报出 477 处「失效引用」，全是 `.json`→`.js`。
 */
const REPO_PATH =
  /(?<![\w/.@-])(?:src|scripts|docs|public|supabase|e2e|\.github|node_modules)\/[\w\-.@/[\]]*?\.(?:tsx|mjs|json|sql|yaml|css|md|ts|js|html|png|svg|txt)(?![\w-])/g;

/**
 * 被引号紧邻包裹的路径：那是「代码写成这样」的示例，不是对仓库文件的引用。
 *
 * **只认直引号，不认反引号**：本仓注释点名文件的主流写法是用反引号包住路径
 * （"src/lib/content.ts" 那种形状就是它），把反引号也算作「示例」等于把整条判据清空——
 * 实测那样收窄后失效引用从 4 处涨到 0 处，那不是仓库干净了，是门禁瞎了。
 */
const QUOTED = /["'][\w\-.@/[\]]*\.(?:tsx|mjs|json|sql|yaml|css|md|ts|js|html|png|svg|txt)["']/g;

/** 依赖包内的文件：`node_modules/...`，或从包名直接起头的 `@scope/pkg/dist/...`。 */
const DEPENDENCY_ROOT = /^node_modules\//;

/** 日期模板与通配写法：不是具体文件名（`docs/kb-changelog-YYYY-MM-DD.md` 那一族）。 */
const PLACEHOLDER = /\{|YYYY|MM-DD/;

/**
 * 一行注释里点名的仓库路径。
 *
 * 先剥掉引号包裹的片段，再匹配：`path.join(root, "docs/x.md")` 里那个 "docs/x.md"
 * 是在说明「落盘路径要写成这个字面形状」，它从来不是一个仓库文件。
 */
export function extractCommentPathRefs(line) {
  if (!COMMENT_LINE.test(line)) return [];
  const stripped = line.replace(QUOTED, (m) => " ".repeat(m.length));
  return [...new Set(stripped.match(REPO_PATH) ?? [])]
    .map((ref) => ref.replace(/[.,;:]+$/, ""))
    // 占位符在抽取阶段就滤掉：它不是一个引用，计进引用数会让地板量到假的分母
    .filter((ref) => !PLACEHOLDER.test(ref));
}

/**
 * 一条引用可以在哪些根下核对存在性：任一命中即算存在。
 *
 * 为什么是「多根候选」而不是「看行里有没有 kline-buty 就整行改根」：
 * 同一行常常同时点名两个仓库的东西——`scripts/risk-warning-lib.mjs` 那句
 * 「产品红线（docs/plan.md）：…（继承 kline-buty 规范）」里，`docs/plan.md` 是本站的，
 * `scripts/kb-anchor-check.mjs` 才是子模块的。按整行改根会把前者判成失效引用。
 *
 * @param {string} ref 注释里点名的路径
 * @returns {{kind: "checked", candidates: string[]}}
 */
export function resolveRef(ref) {
  if (DEPENDENCY_ROOT.test(ref)) return { kind: "checked", candidates: [ref] };
  return { kind: "checked", candidates: [ref, `content/kline-buty/${ref}`] };
}

/**
 * 实测（2026-10-13）：379 份非测试源码的注释里共 140 条仓库路径引用。
 * 地板取 60：正则被改坏、注释识别失效，都会让引用数断崖式下跌——
 * 「一条都没认出来」和「全部合规」过去会长得一模一样（R16.83 那一族）。
 */
export const MIN_REFS_FLOOR = 60;

/**
 * 有意不存在的引用：每条都必须写明理由，并由 `auditCommentPathClaims` 反向核对。
 *
 * 这张表的存在意义不是「放过两处」，而是让「放过」成为一个要签字、且会被追问的决定：
 * 每条都要 (a) 仍然出现在被扫文件里，(b) 仍然不存在。哪天那个占位名变成真文件，
 * 豁免自动失效转红——与 `intentionalAbsentExamples`（roadmap 那条门禁）同一形状。
 */
export const COMMENT_PATH_EXCUSED = Object.freeze([
  {
    ref: "src/lib/kb-links.ts",
    file: "scripts/comment-path-lib.mjs",
    reason:
      "本门禁的病灶叙述：被点名的是本轮**已改掉**的错误写法（真实主人是 src/lib/content.ts）。" +
      "留着它是为了让下一个人知道这道门禁为什么存在；它若哪天变成真文件，豁免自动转红",
  },
  {
    ref: "docs/whatever.md",
    file: "scripts/docs-consistency-lib.mjs",
    reason:
      "R16.315 的反例叙述：「新建一份 docs/whatever.md 抄个数字」说的正是登记制要拦的那种文件，它本不该存在",
  },
]);

/**
 * @param {{sources: Record<string,string>, trackedFiles: Set<string>, existsSync: (p:string)=>boolean,
 *   isIgnored?: (p:string)=>boolean}} input
 * @returns {{issues: string[], refs: number, files: number}}
 */
export function auditCommentPathClaims({
  sources,
  trackedFiles,
  existsSync,
  isIgnored = () => false,
}) {
  const issues = [];
  let refs = 0;
  const excusesSeen = new Set();
  for (const [file, text] of Object.entries(sources)) {
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      for (const ref of extractCommentPathRefs(lines[i])) {
        refs += 1;
        const resolved = resolveRef(ref);
        if (resolved.kind === "skip") continue;
        const landed = resolved.candidates.some(
          (candidate) => trackedFiles.has(candidate) || existsSync(candidate),
        );
        // 构建产物：`.gitignore` 掉的路径在干净检出上本来就不存在，注释指向它是正确用法
        // （`src/lib/kb-titles.json` 由 prebuild 生成，被四处门禁读取并点名）。判据必须
        // 与「这个路径归谁产出」无关，否则同一句话在构建过的机器上绿、在 CI 首跑上红。
        if (!landed && resolved.candidates.some(isIgnored)) continue;
        const excuse = COMMENT_PATH_EXCUSED.find((e) => e.ref === ref && e.file === file);
        if (excuse) {
          if (landed) {
            issues.push(
              `${file}:${i + 1} 豁免已失效——${ref} 如今真的存在了，请删掉这条豁免`,
            );
          }
          excusesSeen.add(`${file}|${ref}`);
          continue;
        }
        if (!landed) {
          issues.push(
            `${file}:${i + 1} 注释点名的 ${ref} 不存在（本站与 kline-buty 两个根下都没有它）`,
          );
        }
      }
    }
  }
  // 豁免表里的条目若不再出现在被扫源码中，说明那句话被改掉了：这条豁免已经不再为任何东西让路。
  for (const excuse of COMMENT_PATH_EXCUSED) {
    const key = `${excuse.file}|${excuse.ref}`;
    if (!excusesSeen.has(key)) {
      issues.push(`豁免条目 ${excuse.file} → ${excuse.ref} 这次没有被用到：那句话已改掉，请删掉这一条`);
    }
  }
  return { issues, refs, files: Object.keys(sources).length };
}
