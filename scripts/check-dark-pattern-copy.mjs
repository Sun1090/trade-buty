/**
 * R13.21：增长文案不得引入暗黑模式。
 *
 * 增长表面（安装提示 / 邀请 banner / 召回 toast / 邮件订阅 / 分享卡 / 分享落地页 CTA）
 * 必须在 src/lib/growth-surfaces.json 登记，并且：
 *   1. 双语字典存在对应 section（或 keyPrefix），不会只有单一语言；
 *   2. 文案不含虚假紧迫、虚假稀缺、愧疚式挽留、伪造社会认同等话术；
 *   3. 声明 requiresDismiss 的表面必须给出中性关闭文案，组件里真的有可点的关闭控件；
 *   4. 声明 blocking: false 的表面不得使用 role="dialog" / aria-modal（不得拦截正文）；
 *   5. 不得用 setInterval 制造倒计时，不得 autoFocus 抢焦点，不得默认勾选。
 *
 * 退出码非 0 表示违规。运行：npm run check:dark-pattern-copy
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** 暗黑模式话术黑名单（中文）。 */
export const BANNED_ZH = [
  ["虚假紧迫", /限时|倒计时|最后机会|最后一天|仅此一次|再不.{0,8}就(没|晚|来不及)|马上(抢|结束|涨价)|即将(结束|截止|涨价)/],
  ["虚假稀缺", /仅剩|名额有限|手慢无|售完|限量|即将售罄|仅限\s*\d/],
  ["愧疚式挽留", /确定要放弃|真的要放弃|你忍心|别走|不要走|错过就(亏|没)|错过不再/],
  ["伪造社会认同", /(已有|超过|多达)\s*[\d,.]+\s*(万|千)?\s*(人|用户|学员)|大家都在|人人都(在|已)|都在抢/],
];

/** 暗黑模式话术黑名单（英文）。 */
export const BANNED_EN = [
  ["fake urgency", /\b(limited[- ]time|countdown|last chance|act now|expires? (soon|tonight|today)|only \d+ (hours?|minutes?|days?) left|before it'?s too late|hurry)\b/i],
  ["false scarcity", /\b(only \d+ (spots?|seats?|left)|spots? are (filling|limited)|selling out|almost gone|limited (spots|seats|supply))\b/i],
  ["guilt trip", /\b(are you sure you want to (quit|leave)|don'?t abandon|you'?ll regret|don'?t walk away|please don'?t go)\b/i],
  ["fake social proof", /\b(\d[\d,]*\+? (people|learners|users|traders) (are|have|already|joined)|join(ing)? \d[\d,]* (people|learners)|everyone is|thousands (already|of (people|learners)))\b/i],
];

/** 关闭文案不得是「负罪式自我否定」。 */
export const DISMISS_SHAMING = [
  /不感兴趣|我不想|放弃|退出学习/,
  /\b(no thanks,? i (don'?t|hate)|i don'?t want to learn|i'?ll stay ignorant|i give up)\b/i,
];

function skipString(src, i, quote) {
  i += 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === quote) return i + 1;
    i += 1;
  }
  return i;
}

function skipTemplate(src, i) {
  i += 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "`") return i + 1;
    if (ch === "$" && src[i + 1] === "{") {
      let depth = 1;
      i += 2;
      while (i < src.length && depth > 0) {
        const c = src[i];
        if (c === "\\") {
          i += 2;
          continue;
        }
        if (c === "`") {
          i = skipTemplate(src, i);
          continue;
        }
        if (c === '"' || c === "'") {
          i = skipString(src, i, c);
          continue;
        }
        if (c === "{") depth += 1;
        else if (c === "}") depth -= 1;
        i += 1;
      }
      continue;
    }
    i += 1;
  }
  return i;
}

/** 从 `{` 开始做括号匹配，返回完整对象文本（自动跳过字符串、模板与注释）。 */
export function extractObjectBlock(src, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i);
      if (nl === -1) return null;
      i = nl;
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      if (end === -1) return null;
      i = end + 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      i = skipString(src, i, ch) - 1;
      continue;
    }
    if (ch === "`") {
      i = skipTemplate(src, i) - 1;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(openIndex, i + 1);
    }
  }
  return null;
}

/** 取出 `const zh: Dict = {` / `const en: Dict = {` 的顶层对象文本。 */
export function extractLocaleBlock(src, locale) {
  const re = new RegExp(`const\\s+${locale}(?:\\s*:\\s*[A-Za-z]+)?\\s*=\\s*\\{`);
  const match = re.exec(src);
  if (!match) return null;
  return extractObjectBlock(src, match.index + match[0].length - 1);
}

/** 取出 section（如 `share:`）对应的对象文本；找不到返回 null。 */
export function extractSection(block, section) {
  if (!block) return null;
  const re = new RegExp(`\\n\\s{2}${section}\\s*:\\s*\\{`);
  const match = re.exec(block);
  if (!match) return null;
  return extractObjectBlock(block, match.index + match[0].length - 1);
}

/** 把 section 文本拆成 `key -> 该条文案原文`（按 4 空格缩进的顶层键切开）。 */
export function extractEntries(sectionText) {
  if (!sectionText) return {};
  const entries = {};
  const re = /\n {4}([A-Za-z_$][\w$]*)\s*:/g;
  const marks = [];
  let m;
  while ((m = re.exec(sectionText)) !== null) {
    marks.push({ key: m[1], start: m.index });
  }
  for (let i = 0; i < marks.length; i += 1) {
    const cur = marks[i];
    const end = i + 1 < marks.length ? marks[i + 1].start : sectionText.length;
    entries[cur.key] = sectionText.slice(cur.start, end);
  }
  return entries;
}

/** 收集文案里所有字符串/模板字面量的内容。 */
export function collectStringLiterals(text) {
  const out = [];
  const re = /(["'`])((?:\\.|(?!\1)[\s\S])*)\1/g;
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[2]);
  return out;
}

/** 扫描一组文案，返回 [{rule, sample}]。 */
export function scanCopy(literals, banned) {
  const hits = [];
  for (const raw of literals) {
    for (const [rule, re] of banned) {
      if (re.test(raw)) hits.push({ rule, sample: raw.slice(0, 80) });
    }
  }
  return hits;
}

/** 扫描组件源码里的结构性暗黑模式。返回 [{rule, detail}]。 */
export function scanComponent(src, surface) {
  const hits = [];
  if (surface.blocking === false) {
    if (/role\s*=\s*["']dialog["']/.test(src)) hits.push({ rule: "blocking-dialog", detail: 'blocking:false 的表面出现了 role="dialog"' });
    if (/aria-modal\s*=\s*["']true["']/.test(src)) hits.push({ rule: "blocking-dialog", detail: 'blocking:false 的表面出现了 aria-modal="true"' });
  }
  if (/setInterval\s*\(/.test(src)) hits.push({ rule: "countdown", detail: "使用 setInterval 制造倒计时/紧迫感" });
  if (/autoFocus/.test(src)) hits.push({ rule: "forced-focus", detail: "autoFocus 抢焦点" });
  if (/defaultChecked/.test(src)) hits.push({ rule: "default-opt-in", detail: "defaultChecked 默认勾选" });
  if (surface.requiresDismiss) {
    const hasButton = /<button\b/.test(src);
    const hasDismissHandler = /(handleDismiss|dismiss|setOpen\(false\)|markDone|handleSkip|handleClear)/i.test(src);
    if (!hasButton || !hasDismissHandler) {
      hits.push({ rule: "missing-dismiss", detail: "requiresDismiss 但没有可点的关闭控件" });
    }
  }
  return hits;
}

function toLiteralsForSection(zhBlock, enBlock, surface) {
  const fromSection = (block) => {
    const section = extractSection(block, surface.i18nSection);
    if (!section) return { section, literals: [] };
    let text = section;
    if (surface.keyPrefix) {
      const entries = extractEntries(section);
      const kept = Object.entries(entries)
        .filter(([key]) => key.startsWith(surface.keyPrefix))
        .map(([, value]) => value)
        .join("\n");
      text = kept;
    }
    return { section, literals: collectStringLiterals(text) };
  };
  return { zh: fromSection(zhBlock), en: fromSection(enBlock) };
}

const GROWTH_COMPONENT_HINT = /(prompt|banner|nudge|signup|share-card)/i;

/** 找出名字像增长表面但没登记、也不在豁免清单里的组件。 */
export function findUnregisteredGrowthComponents({ rootDir, inventory }) {
  const componentDir = join(rootDir, "src/components");
  if (!existsSync(componentDir)) return [];
  const registered = new Set((inventory.surfaces ?? []).map((s) => s.component));
  const allowed = new Set((inventory.unregisteredAllowed ?? []).map((e) => e.component));
  const missing = [];
  for (const name of readdirSync(componentDir)) {
    if (!name.endsWith(".tsx") || name.endsWith(".test.tsx")) continue;
    if (!GROWTH_COMPONENT_HINT.test(name)) continue;
    const rel = `src/components/${name}`;
    if (!registered.has(rel) && !allowed.has(rel)) missing.push(rel);
  }
  return missing;
}

export function auditGrowthSurfaces({ rootDir, inventory, i18nSource }) {
  const errors = [];
  const info = [];
  if (!inventory || !Array.isArray(inventory.surfaces)) {
    errors.push({ rule: "inventory", detail: "growth-surfaces.json 缺少 surfaces 数组" });
    return { errors, info };
  }

  for (const entry of inventory.unregisteredAllowed ?? []) {
    if (!entry.component || !entry.reason) {
      errors.push({ rule: "inventory", detail: "unregisteredAllowed 条目必须带 component 与 reason" });
    }
  }
  for (const missing of findUnregisteredGrowthComponents({ rootDir, inventory })) {
    errors.push({ rule: "unregistered", detail: `${missing} 看起来是增长表面但未登记，也未说明豁免原因` });
  }

  const zhBlock = extractLocaleBlock(i18nSource, "zh");
  const enBlock = extractLocaleBlock(i18nSource, "en");
  if (!zhBlock) errors.push({ rule: "i18n", detail: "未找到 zh 字典块" });
  if (!enBlock) errors.push({ rule: "i18n", detail: "未找到 en 字典块" });

  const seen = new Set();
  for (const surface of inventory.surfaces) {
    if (!surface.id) {
      errors.push({ rule: "inventory", detail: "增长表面缺少 id" });
      continue;
    }
    if (seen.has(surface.id)) {
      errors.push({ rule: "inventory", detail: `重复登记的增长表面 ${surface.id}` });
    }
    seen.add(surface.id);

    if (!surface.component || !existsSync(join(rootDir, surface.component))) {
      errors.push({ rule: "inventory", detail: `${surface.id} 的 component 不存在：${surface.component}` });
      continue;
    }

    const { zh, en } = toLiteralsForSection(zhBlock, enBlock, surface);
    if (!zh.section) errors.push({ rule: "i18n", detail: `${surface.id} 缺少 zh section ${surface.i18nSection}` });
    if (!en.section) errors.push({ rule: "i18n", detail: `${surface.id} 缺少 en section ${surface.i18nSection}` });

    for (const hit of scanCopy(zh.literals, BANNED_ZH)) {
      errors.push({ rule: `zh/${hit.rule}`, detail: `${surface.id}: "${hit.sample}"` });
    }
    for (const hit of scanCopy(en.literals, BANNED_EN)) {
      errors.push({ rule: `en/${hit.rule}`, detail: `${surface.id}: "${hit.sample}"` });
    }
    for (const hit of scanCopy(zh.literals, [["guilt-dismiss", DISMISS_SHAMING[0]]])) {
      errors.push({ rule: `zh/${hit.rule}`, detail: `${surface.id}: "${hit.sample}"` });
    }
    for (const hit of scanCopy(en.literals, [["guilt-dismiss", DISMISS_SHAMING[1]]])) {
      errors.push({ rule: `en/${hit.rule}`, detail: `${surface.id}: "${hit.sample}"` });
    }

    for (const dismissKey of surface.dismissKeys ?? []) {
      const present = zh.literals.length > 0 && en.literals.length > 0 &&
        new RegExp(`\\n {4}${dismissKey}\\s*:`).test(zh.section ?? "") &&
        new RegExp(`\\n {4}${dismissKey}\\s*:`).test(en.section ?? "");
      if (!present) {
        errors.push({ rule: "dismiss-copy", detail: `${surface.id} 缺少双语关闭文案 ${dismissKey}` });
      }
    }

    const component = readFileSync(join(rootDir, surface.component), "utf8");
    for (const hit of scanComponent(component, surface)) {
      errors.push({ rule: hit.rule, detail: `${surface.id}: ${hit.detail}` });
    }
    info.push(surface.id);
  }

  return { errors, info };
}

export function loadInventory(rootDir) {
  const raw = readFileSync(join(rootDir, "src/lib/growth-surfaces.json"), "utf8");
  return JSON.parse(raw);
}

export function main() {
  let inventory;
  try {
    inventory = loadInventory(root);
  } catch (error) {
    console.error("❌ 读取 src/lib/growth-surfaces.json 失败：", error.message);
    process.exit(1);
  }
  const i18nSource = readFileSync(join(root, "src/lib/i18n.ts"), "utf8");
  const { errors, info } = auditGrowthSurfaces({ rootDir: root, inventory, i18nSource });
  if (errors.length > 0) {
    console.error(`❌ 增长文案暗黑模式门禁失败（${errors.length} 项）：`);
    for (const error of errors) console.error(`  - [${error.rule}] ${error.detail}`);
    process.exit(1);
  }
  console.log(`✅ 增长文案无暗黑模式（R13.21 通过）：${info.length} 个登记表面 · 双语 · 可关闭/非阻断`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
