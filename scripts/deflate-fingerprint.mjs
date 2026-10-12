/**
 * R16.321：「同一份产物量出多少字节」依赖宿主 zlib 的 deflate 行为，
 * 而 `docs/perf-notes.md` 那张复测表的实测列是**逐字**比对的（R16.306 明写不给容差）。
 * 所以要判「现在这台机器量出来的数，跟录表那台机器是不是同一把尺」，
 * 不能靠版本号，只能**当场量行为**。
 *
 * 为什么不用 `process.versions.zlib` 当指纹（登记 R16.321 时我以为可以，随后实测否掉）：
 * linux 上 node 20/22 报 `1.3.1-e00f703`、node 24/26 报 `1.3.2.1-motley-*`，
 * 版本串不同，而 15 组产物读数**字节级逐字相同**（0/15 差异）。
 * 版本串变了不代表行为变了——拿它当指纹会**误跳过**（过度敏感），
 * 反过来「串相同而行为不同」也无法排除。所以这里量的是「这段输入压成多少字节」本身。
 *
 * 实测分布（同一份本地产物，只换测量环境）：
 * - darwin（node 26 / 系统 libz 1.2.12）：`jsonish-6k=1457 jsish-256k=60794 jsish-1m=240799`
 * - linux（node 20 / 22 / 24 / 26 × alpine / bookworm-slim，六种组合）：
 *   `jsonish-6k=1454 jsish-256k=58973 jsish-1m=234113`——**六种逐字相同**
 * 也就是说这个指纹区分得开「本地 vs CI」，又不会被发行版、musl/glibc、node 主版本误导。
 *
 * 纯函数、无副作用：`gzip` 由调用方注入，便于用例拿假实现验证判据真的读了它。
 */

import { createHash } from "node:crypto";

/** 确定性伪随机（固定种子，不依赖 Math.random，跨进程跨机器可复现） */
function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** 一大块「像打包后 JS」的文本：标识符 + 数字 + 结构符号混排 */
function jsish(bytes) {
  const rand = lcg(20261013);
  const idents = [
    "createElement",
    "useState",
    "getStudySeries",
    "props",
    "children",
    "className",
    "undefined",
    "function",
    "return",
    "async",
  ];
  const out = [];
  let size = 0;
  while (size < bytes) {
    const piece =
      rand() < 0.5
        ? idents[Math.floor(rand() * idents.length)]
        : `var x${Math.floor(rand() * 9999)}=${Math.floor(rand() * 1e9)};if(${Math.floor(
            rand() * 2,
          )}){return"${idents[Math.floor(rand() * idents.length)]}"}\n`;
    out.push(piece);
    size += piece.length;
  }
  return out.join("");
}

/**
 * 探针输入。形状是有意配齐的，不是随手列的：
 * - 空串与单字节：有些实现会在极短输入上走旁路；
 * - 全零 / 高重复 / 近随机 / 中文 UTF-8 / JSON：覆盖不同的匹配长度与字面量比例；
 * - **256KB 与 1MB 那两条是本轮补的**：只有小块的话，两个实现在 KB 级输入上表现一致、
 *   在 200KB 级输入上分道扬镳，指纹就会漏判「该分时不分」。实测确实分得开：
 *   darwin 与 linux 在 `jsonish-6k` 上差 3 字节，在 `jsish-256k` 上差 1821 字节。
 */
export const DEFALATE_PROBE_CASES = Object.freeze([
  ["empty", ""],
  ["one", "a"],
  ["zeros-1k", "\0".repeat(1024)],
  ["ascii-4k", "The quick brown fox jumps over the lazy dog. ".repeat(80)],
  ["repeat-16k", "ab".repeat(8192)],
  [
    "randomish-8k",
    Array.from({ length: 8192 }, (_, i) => String.fromCharCode(33 + ((i * 7919) % 90))).join(""),
  ],
  ["utf8-cjk-2k", "行情永远都在，页面不一定。".repeat(120)],
  [
    "jsonish-6k",
    JSON.stringify({
      rows: Array.from({ length: 200 }, (_, i) => ({ id: i, name: `n${i}`, v: i * 1.5 })),
    }),
  ],
  ["jsish-256k", jsish(256 * 1024)],
  ["jsish-1m", jsish(1024 * 1024)],
]);

/** 拿一个 gzip 实现量出完整指纹串（`名字=字节数` 空格分隔） */
export function deflateFingerprint(gzip) {
  if (typeof gzip !== "function") throw new Error("deflateFingerprint 需要一个 gzip 函数");
  return DEFALATE_PROBE_CASES.map(
    ([name, text]) => `${name}=${gzip(Buffer.from(text, "utf8")).length}`,
  ).join(" ");
}

/** 指纹太长，登记进文档时用它的 sha256 前 12 位；判据比对的是完整串 */
export function fingerprintId(fingerprint) {
  if (typeof fingerprint !== "string" || fingerprint.length === 0) {
    throw new Error("fingerprintId 需要非空字符串");
  }
  return createHash("sha256").update(fingerprint).digest("hex").slice(0, 12);
}
