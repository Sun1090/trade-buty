/**
 * R6.11：内容宪法扫描——违禁表述正则巡检。
 *
 * 内容红线（docs/plan.md）：不承诺收益、不荐股、不导流开户。
 * 知识库大量教育性引用黑话作反面教材（「不要喊单」「这是违规」），
 * 因此默认为报告式巡检（exit 0 + 明细输出）；内容全部整改后可用 --strict
 * 升级为 CI 阻断。教育语境豁免：否定词 / 违规判定 / 示例场景等上下文。
 * 用法：npm run check:constitution [-- --strict]
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const KB = path.join(root, "content/kline-buty/docs/knowledge");

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

// 高危：导流 / 荐股黑话（教育语境也基本不会出现）
const HARD_BAN = [
  /加\s*(微信|VX|vx|QQ|qq)/,
  /(扫码|扫描二维码).{0,6}(入群|进群|加群)/,
  /(老师|导师|分析师)?带单/,
  /喊单/,
  /(开户|入金)(返佣|返现|福利)/,
  /内部(消息|内幕|群)/,
  /(独家|vip)通道/,
  /(荐股|股票推荐群)/,
];

// 收益承诺类：教育语境可能引用（如「不要相信稳赚不赔」），需排除否定语境
const PROFIT_PROMISE = [
  /稳赚(不赔|不亏)?/,
  /保证(收益|赚钱|盈利)/,
  /(必涨|必赚|百分百胜|包赚)/,
  /(翻倍|暴富)(秘籍|公式|战法)/,
  /guaranteed\s+(profit|return|income)/i,
  /risk[- ]?free\s+(profit|return)/i,
];

// 否定/教育语境豁免词：命中行包含这些词时视为在教育性引用
const NEGATION = [
  /不要|切勿|谨防|警惕|骗局|陷阱|谣言|拒绝|不参与|不属于|不算|不能|避免|远离|禁止|违规|红线|高危|道德|风险|违法|监管|处罚|封号|限流|下架|边界|反面|误区|谎|假|幻觉|示例|例子|场景|清单|判断|常识|叙事|话术|识别|考察|验证|反向|反面教材|❌| my幻ths |myths|never|avoid|scam|warning|fiction|illusion|illegal|fraud/i,
];
const STRICT = process.argv.includes("--strict");

function hasNegation(line) {
  return NEGATION.some((r) => r.test(line));
}

const files = [
  ...walk(KB),
  path.join(root, "src/lib/quizzes.ts"), // 站方自有内容（题库解析）也受宪法约束
].filter((f) => fs.existsSync(f));

const hard = [];
const profit = [];

for (const file of files) {
  const rel = path.relative(root, file);
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const r of HARD_BAN) {
      if (r.test(line)) hard.push(`${rel}:${i + 1}  ${line.trim().slice(0, 60)}`);
    }
    if (!hasNegation(line)) {
      for (const r of PROFIT_PROMISE) {
        if (r.test(line)) profit.push(`${rel}:${i + 1}  ${line.trim().slice(0, 60)}`);
      }
    }
  });
}

const total = hard.length + profit.length;
if (total === 0) {
  console.log(`✅ 内容宪法扫描通过（${files.length} 个文件，零命中）`);
  process.exit(0);
}
if (hard.length > 0) {
  console.error(`⚠️ 内容宪法：高危模式（导流/荐股黑话）命中 ${hard.length} 处（多为教育性引用，需人工抽查）：`);
  console.error(hard.slice(0, 30).join("\n"));
}
if (profit.length > 0) {
  console.error(`⚠️ 内容宪法：疑似收益承诺 ${profit.length} 处：`);
  console.error(profit.slice(0, 30).join("\n"));
}
console.log(
  STRICT
    ? "❌ strict 模式：存在命中，CI 阻断"
    : `ℹ️ 报告式巡检（共 ${total} 处命中，教育语境豁免后）。整改后可加 --strict 升级为阻断`,
);
if (STRICT) process.exit(1);
