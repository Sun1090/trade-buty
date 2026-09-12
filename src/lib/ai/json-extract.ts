/**
 * R7.12：LLM 输出 JSON 宽松提取。
 *
 * 模型即使被 prompt 要求「严格 JSON」，实践中仍常返回：
 * - ```json ... ``` 围栏（最常见）
 * - 前后带解释性文字（"好的，这是结果：{...}"）
 * - JSON 之后带 trailing comma
 *
 * 直接 JSON.parse 会抛错，导致 route 返回 502 或错误降级。这里做三件事：
 * 剥围栏 → 取最外层配对括号区间 → 解析；并额外容忍末尾多余逗号。
 * 任何一步失败都返回 null，绝不向调用方抛错（调用方据此走降级路径）。
 */

/** 把全角括号/省略号等无法表示的写法留给调用方，这里只处理结构问题。 */
function sliceBalancedJson(text: string): string | null {
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "{" || c === "[") {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{" || c === "[") {
      depth++;
      continue;
    }
    if (c === "}" || c === "]") {
      depth--;
      // 多余的收尾括号（模型幻觉）会让 depth 变负，此时视为无效
      if (depth < 0) return null;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** 仅删除对象/数组末尾的多余逗号（`,}` / `,]`），不动字符串内部。 */
function stripTrailingCommas(text: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      out += c;
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }
    if (c === ",") {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === "}" || text[j] === "]") continue; // 跳过该逗号
    }
    out += c;
  }
  return out;
}

/**
 * 从模型输出中抽出 JSON 字符串片段（不含解析）。
 * 找不到可配对的 JSON 区间时返回 null。
 */
export function extractJsonBlock(text: string): string | null {
  if (typeof text !== "string") return null;
  let s = text.trim();
  if (!s) return null;

  // 1) 优先取 markdown 代码围栏内部
  const fenced = s.match(/```(?:json)?\s*\n?([\s\S]*?)```/i);
  if (fenced && fenced[1].trim()) {
    s = fenced[1].trim();
  } else {
    s = s.replace(/^```[a-zA-Z]*\s*/, "").replace(/```\s*$/, "").trim();
  }

  // 2) 取最外层配对区间
  return sliceBalancedJson(s);
}

/**
 * 宽松解析模型输出的 JSON。失败返回 null（不抛错）。
 *
 * @param text 模型原始输出
 */
export function parseJsonLoose<T = unknown>(text: string): T | null {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 快路径：本身就是合法 JSON（含顶层标量）
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // 落到宽松路径
  }

  const block = extractJsonBlock(trimmed);
  if (!block) return null;

  try {
    return JSON.parse(block) as T;
  } catch {
    // 最后一次尝试：容忍末尾多余逗号
    try {
      return JSON.parse(stripTrailingCommas(block)) as T;
    } catch {
      return null;
    }
  }
}
