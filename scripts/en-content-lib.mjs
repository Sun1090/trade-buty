/**
 * R16.13 英文树内容实测的纯函数库。
 *
 * 与 R10.19/R10.20 的分工：那两道量的是「文件名对不对得上」，这里量的是
 * 「en 目录里的文件到底是不是英文、是不是有内容」——目录齐 ≠ 翻译齐。
 * 界面上那句英文覆盖说法（`/[locale]/path` 的 translationNote）因此有了
 * 可机检的下界，而不只是靠人逐章确认。
 *
 * 度量口径（只写在这里，门禁与报告共用）：
 * - 正文 = 去掉 YAML frontmatter 之后的部分；
 * - CJK 只数汉字/假名/谚文（见 CJK_RANGES），不含中文标点——英文课文里引用
 *   「」或中文书名是正常内容，不该被判成「没翻译」；
 * - 长度比 = en 正文字符数 / 同名 zh 正文字符数；英文同内容通常比中文长
 *   1.7–2.6 倍，所以下界放得很松，抓的是「只翻了开头」这种量级。
 */

/** 汉字（统一表意文字，含扩展 A 起点）、假名、谚文音节三段。 */
const CJK_RANGES = [
  [0x3400, 0x9fff],
  [0x3040, 0x30ff],
  [0xac00, 0xd7a3],
];

/** 单个 en 文件允许的 CJK 字占比上界（2026-09-24 实测最高 0.52%）。 */
export const EN_CJK_MAX_RATIO = 0.02;
/** en 正文相对同名 zh 正文的字符数下界（实测最低 0.53）。 */
export const EN_VS_ZH_MIN_LENGTH_RATIO = 0.3;

function isCjkCodePoint(codePoint) {
  return CJK_RANGES.some(([low, high]) => codePoint >= low && codePoint <= high);
}

/** 按码点数 CJK 字符（代理对算一个）。 */
export function countCjkChars(text) {
  let total = 0;
  for (const char of String(text)) {
    if (isCjkCodePoint(char.codePointAt(0))) total += 1;
  }
  return total;
}

/** 去掉开头的 YAML frontmatter 块；没有该块时原样返回。 */
export function stripFrontmatter(markdown) {
  return String(markdown).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

/**
 * 逐文件实测 en 树。
 * @param {{enFiles: Map<string, string>, zhFiles: Map<string, string>}} files 键为「章节/文件名」相对路径
 * @returns {{rows: Array<object>, summary: object}}
 */
export function measureEnContent({ enFiles, zhFiles }) {
  const rows = [...enFiles].map(([key, text]) => {
    const body = stripFrontmatter(text);
    const chars = [...body].length;
    const cjkChars = countCjkChars(body);
    const zhText = zhFiles.get(key);
    const zhChars = zhText === undefined ? null : [...stripFrontmatter(zhText)].length;
    return {
      key,
      chars,
      cjkChars,
      cjkRatio: chars === 0 ? 0 : cjkChars / chars,
      zhChars,
      lengthRatio: zhChars ? chars / zhChars : null,
    };
  });
  const highestCjk = rows.reduce(
    (acc, row) => (acc === null || row.cjkRatio > acc.cjkRatio ? row : acc),
    null,
  );
  const comparable = rows.filter((row) => row.lengthRatio !== null);
  const thinnest = comparable.reduce(
    (acc, row) => (acc === null || row.lengthRatio < acc.lengthRatio ? row : acc),
    null,
  );
  return {
    rows,
    summary: {
      enFiles: rows.length,
      zhFiles: zhFiles.size,
      unpairedEnFiles: rows.length - comparable.length,
      emptyEnFiles: rows.filter((row) => row.chars === 0).length,
      highestCjkRatio: highestCjk === null ? 0 : highestCjk.cjkRatio,
      highestCjkFile: highestCjk === null ? null : highestCjk.key,
      lowestLengthRatio: thinnest === null ? null : thinnest.lengthRatio,
      lowestLengthFile: thinnest === null ? null : thinnest.key,
    },
  };
}

/**
 * 判定越界项。空正文单独成类：它既不是「没翻译」也不是「翻得短」，是文件本身没内容。
 * @param {{rows: Array<object>}} measured
 * @returns {Array<{key: string, kind: "empty" | "cjk-ratio" | "thin", detail: string}>}
 */
export function findEnContentViolations(measured) {
  const problems = [];
  for (const row of measured.rows) {
    if (row.chars === 0) {
      problems.push({ key: row.key, kind: "empty", detail: "正文为空（frontmatter 之后没有内容）" });
      continue;
    }
    if (row.cjkRatio > EN_CJK_MAX_RATIO) {
      problems.push({
        key: row.key,
        kind: "cjk-ratio",
        detail: `CJK 占比 ${formatPercent(row.cjkRatio)} 超出上界 ${formatPercent(EN_CJK_MAX_RATIO)}`,
      });
    }
    if (row.lengthRatio !== null && row.lengthRatio < EN_VS_ZH_MIN_LENGTH_RATIO) {
      problems.push({
        key: row.key,
        kind: "thin",
        detail: `正文长度是同名中文的 ${formatPercent(row.lengthRatio)}，低于下界 ${formatPercent(EN_VS_ZH_MIN_LENGTH_RATIO)}`,
      });
    }
  }
  return problems;
}

/** 0–1 比例 → 百分比字符串（一位小数）。 */
export function formatPercent(ratio) {
  return `${Math.round(ratio * 1000) / 10}%`;
}
