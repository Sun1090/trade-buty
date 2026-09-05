/**
 * R8.1–R8.3 分享卡：纯前端 canvas 生成 + 下载。
 *
 * 设计要点：
 * - 提供纯函数（gradeFromPercent、truncateForCanvas、color tokens）
 *   供单元测试
 * - 绘图函数 draw*Card(args) 接 CanvasRenderingContext2D：纯画，不读 DOM
 * - 组件层 (quiz-share-card.tsx 等) 用 useEffect 拿到 ctx 后调用绘图函数
 *   → 单测只需覆盖纯函数，画图靠视觉基线 + 手动回归
 */

export type ShareLocale = "zh" | "en";
export type Grade = "S" | "A" | "B" | "C";
export type CardTheme = "dark" | "light";

/** OG/社交卡正方形尺寸（Twitter/微博/小红书常见） */
export const CARD_SIZE = 1080;

/** 适配深色（默认，与站点 hero 视觉一致）和浅色（适合打印）两种主题。 */
export interface CardColors {
  bg: string;
  bgGradientTo: string;
  fg: string;
  fgMuted: string;
  accent: string;
  accentStrong: string;
  grid: string;
}

export const COLORS_DARK: CardColors = {
  bg: "#0a0f0d",
  bgGradientTo: "#0f2a22",
  fg: "#f4faf7",
  fgMuted: "#8da39a",
  accent: "#34d399",
  accentStrong: "#10b981",
  grid: "rgba(52,211,153,0.06)",
};

export const COLORS_LIGHT: CardColors = {
  bg: "#fafdfb",
  bgGradientTo: "#e3f5ec",
  fg: "#0a0f0d",
  fgMuted: "#5a6b65",
  accent: "#047857",
  accentStrong: "#065f46",
  grid: "rgba(4,120,87,0.06)",
};

export function colorsFor(theme: CardTheme): CardColors {
  return theme === "light" ? COLORS_LIGHT : COLORS_DARK;
}

/** 把「答对百分比」映射到 S/A/B/C 评级。S=100% 满分；A=80+；B=60+；C=其余。 */
export function gradeFromPercent(percent: number): Grade {
  if (!Number.isFinite(percent) || percent < 0) return "C";
  if (percent >= 100) return "S";
  if (percent >= 80) return "A";
  if (percent >= 60) return "B";
  return "C";
}

/** 评级配色——S 给金色（满分的奖励感），其余按站点主色梯度 */
export function gradeColor(grade: Grade, colors: CardColors): string {
  switch (grade) {
    case "S":
      return "#fbbf24";
    case "A":
      return colors.accentStrong;
    case "B":
      return colors.accent;
    case "C":
      return colors.fgMuted;
  }
}

/** CJK-aware 截断：CJK 算 1 char；超过 maxChars 时尾部加省略号。用于章节/题库名过长时不被画溢出。 */
export function truncateForCanvas(text: string, maxChars: number): string {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  // 保留 1 个字符位给省略号
  const head = Math.max(0, maxChars - 1);
  return text.slice(0, head) + "…";
}

/** 把数字格式化为 `percent` 整数 + `%`，避免 100/8 显示成 12.5 */
export function formatPercent(n: number): string {
  return `${Math.round(n)}%`;
}

// ──────────────── 通用底图 ────────────────

/** 在画布上铺一层深色径向渐变 + 细网格背景，返回 Promise<void> 同步执行完。 */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: CardColors,
): void {
  // 渐变底
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, colors.bg);
  grad.addColorStop(1, colors.bgGradientTo);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // 细网格（与站点 hero 一致）
  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  const step = 40;
  for (let x = 0; x <= width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

/** 在画布右下角画站点品牌水印（防截屏抹除 + 增加辨识度）。 */
export function drawBrandFooter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: CardColors,
  siteName: string,
  font: string,
): void {
  ctx.save();
  ctx.fillStyle = colors.fgMuted;
  ctx.font = `600 28px ${font}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "right";
  ctx.fillText(siteName, width - 60, height - 50);
  ctx.restore();
}

/** 文字自动居中换行（不依赖 ctx.measureText 的字面宽度，仅按字符数切），
 *  适合 CJK 混排。无 CJK 分词能力——超长词会被原样切碎，画卡够用。 */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let buf = "";
  for (const ch of text) {
    const next = buf + ch;
    if (ctx.measureText(next).width > maxWidth && buf.length > 0) {
      lines.push(buf);
      buf = ch;
    } else {
      buf = next;
    }
  }
  if (buf) lines.push(buf);
  return lines;
}

// ──────────────── R8.1 测验成绩卡 ────────────────

export interface QuizCardArgs {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  chapterTitle: string;
  score: number;
  total: number;
  /** 0–100。允许非整数（如 87.5） */
  percent: number;
  locale: ShareLocale;
  theme: CardTheme;
  siteName: string;
  font: string;
}

/** 在指定画布上画一张「测验成绩」分享卡。完成后调用方只需 `canvas.toBlob`。 */
export function drawQuizCard(args: QuizCardArgs): void {
  const {
    ctx,
    width,
    height,
    chapterTitle,
    score,
    total,
    percent,
    locale,
    theme,
    siteName,
    font,
  } = args;
  const colors = colorsFor(theme);
  const grade = gradeFromPercent(percent);
  const gradeCol = gradeColor(grade, colors);

  drawBackground(ctx, width, height, colors);

  // 上：章节标题（限 2 行）
  ctx.save();
  ctx.fillStyle = colors.fgMuted;
  ctx.font = `500 36px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const heading = locale === "zh" ? "随堂测成绩" : "Quiz Result";
  ctx.fillText(heading, width / 2, 90);

  ctx.fillStyle = colors.fg;
  ctx.font = `700 64px ${font}`;
  const titleLines = wrapText(ctx, truncateForCanvas(chapterTitle, 24), width - 200);
  let y = 160;
  for (const line of titleLines.slice(0, 2)) {
    ctx.fillText(line, width / 2, y);
    y += 78;
  }
  ctx.restore();

  // 中：大评级字母
  ctx.fillStyle = gradeCol;
  ctx.font = `900 420px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(grade, width / 2, height / 2 - 20);

  // 副：分数 / 总分
  ctx.fillStyle = colors.fg;
  ctx.font = `700 72px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(`${score}/${total}`, width / 2, height - 360);

  // 副：正确率进度条
  const barW = 720;
  const barH = 16;
  const barX = (width - barW) / 2;
  const barY = height - 250;
  ctx.fillStyle = colors.grid;
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = gradeCol;
  const w = Math.max(8, (barW * percent) / 100);
  ctx.fillRect(barX, barY, w, barH);

  // 副：百分比文字
  ctx.fillStyle = colors.fg;
  ctx.font = `600 40px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(formatPercent(percent), width / 2, barY + 36);

  drawBrandFooter(ctx, width, height, colors, siteName, font);
}

// ──────────────── R8.2 回放战绩卡 ────────────────

/**
 * 回放训练有自己的评级标准（盘感更难，阈值更低）：
 *   S ≥ 70% 准确率 + 命中 ≥ 3 次
 *   A ≥ 60%
 *   B ≥ 50%
 *   C 其余
 *
 * 与 R8.1 测验不同：测验答案固定，回放是对抗随机走势——所以阈值宽松一点。
 * 复用 R8.1 的 Grade 字母+颜色语义。
 */
export function gradeFromReplayAccuracy(accuracy: number, totalGuesses: number): Grade {
  if (!Number.isFinite(accuracy) || accuracy < 0 || totalGuesses < 3) return "C";
  if (accuracy >= 0.7) return "S";
  if (accuracy >= 0.6) return "A";
  if (accuracy >= 0.5) return "B";
  return "C";
}

export interface ReplayCardArgs {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  symbol: string;
  interval: string;
  correct: number;
  total: number;
  /** 0–1（不是 0–100） */
  accuracy: number;
  bestStreak: number;
  currentStreak: number;
  locale: ShareLocale;
  theme: CardTheme;
  siteName: string;
  font: string;
}

/** 在指定画布上画一张「回放战绩」分享卡。 */
export function drawReplayCard(args: ReplayCardArgs): void {
  const {
    ctx,
    width,
    height,
    symbol,
    interval,
    correct,
    total,
    accuracy,
    bestStreak,
    currentStreak,
    locale,
    theme,
    siteName,
    font,
  } = args;
  const colors = colorsFor(theme);
  const percent = accuracy * 100;
  const grade = gradeFromReplayAccuracy(accuracy, total);
  const gradeCol = gradeColor(grade, colors);

  drawBackground(ctx, width, height, colors);

  // 上：标题 + 标的/周期
  ctx.save();
  ctx.fillStyle = colors.fgMuted;
  ctx.font = `500 36px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const heading = locale === "zh" ? "回放战绩" : "Replay Result";
  ctx.fillText(heading, width / 2, 90);

  ctx.fillStyle = colors.fg;
  ctx.font = `700 56px ${font}`;
  ctx.textAlign = "center";
  ctx.fillText(
    truncateForCanvas(`${symbol} · ${interval}`, 18),
    width / 2,
    160,
  );
  ctx.restore();

  // 中：大评级字母 + 准确率
  ctx.fillStyle = gradeCol;
  ctx.font = `900 360px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(grade, width / 2, height / 2 - 40);

  ctx.fillStyle = colors.fg;
  ctx.font = `800 96px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(formatPercent(percent), width / 2, height - 460);

  ctx.fillStyle = colors.fgMuted;
  ctx.font = `500 32px ${font}`;
  ctx.textAlign = "center";
  ctx.fillText(
    locale === "zh"
      ? `${correct}/${total} 命中`
      : `${correct}/${total} correct`,
    width / 2,
    height - 360,
  );

  // 底：连胜 + 最佳连胜 双指标
  const blockY = height - 200;
  const blockW = (width - 180) / 2;
  drawMetricBlock(ctx, 60 + blockW / 2, blockY, blockW, colors,
    locale === "zh" ? "本轮连胜" : "Streak",
    String(currentStreak),
    locale === "zh" ? "连" : "",
    font,
  );
  drawMetricBlock(ctx, width - 60 - blockW / 2, blockY, blockW, colors,
    locale === "zh" ? "最佳连胜" : "Best streak",
    String(bestStreak),
    locale === "zh" ? "连" : "",
    font,
  );

  drawBrandFooter(ctx, width, height, colors, siteName, font);
}

/** 在画布底部画一个 metric 数据块（带边框的圆角矩形 + 大数字 + 小标签）。 */
function drawMetricBlock(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  y: number,
  w: number,
  colors: CardColors,
  label: string,
  value: string,
  unit: string,
  font: string,
): void {
  const h = 130;
  const x = centerX - w / 2;
  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 2;
  // 用背景色填充（轻微透明度），用网格色描边
  ctx.fillStyle = colors.bgGradientTo;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();

  // 数字（居中）
  ctx.fillStyle = colors.fg;
  ctx.font = `800 72px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(unit ? `${value}${unit}` : value, centerX, y + h / 2 - 8);

  // 标签（底部）
  ctx.fillStyle = colors.fgMuted;
  ctx.font = `500 24px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(label, centerX, y + h - 12);
}