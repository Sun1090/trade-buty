import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { auditRequestBodyBounds, collectRouteFiles } from "./request-body-bounds.mjs";

const POST_WITH_BOUND = `
export const MAX_BODY_BYTES = 4_096;
export async function POST(req) {
  const read = await readJsonBody(req, MAX_BODY_BYTES);
  if (!read.ok) return NextResponse.json({ error: "bad" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
`;

describe("request body bound audit（R15.4①）", () => {
  it("直接 req.json() 解析请求体即违规，并点名文件", () => {
    const errors = auditRequestBodyBounds({
      "src/app/api/ai/newthing/route.ts": `
export async function POST(req) {
  const body = await req.json();
  return NextResponse.json({ ok: !!body });
}
`,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("src/app/api/ai/newthing/route.ts");
    expect(errors[0]).toContain("readJsonBody");
  });

  it("走有界读取且上限是具名常量则通过", () => {
    expect(auditRequestBodyBounds({ "src/app/api/x/route.ts": POST_WITH_BOUND })).toEqual([]);
  });

  it("上限写成行内数字时拒绝：上限必须能在路由里读出来", () => {
    const errors = auditRequestBodyBounds({
      "src/app/api/x/route.ts": POST_WITH_BOUND.replace(
        "readJsonBody(req, MAX_BODY_BYTES)",
        "readJsonBody(req, 4096)",
      ),
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("具名常量");
  });

  it("注释里提到 req.json() 不算违规", () => {
    const errors = auditRequestBodyBounds({
      "src/app/api/x/route.ts": `
// 这里以前写 await req.json()，现在改成有界读取。
${POST_WITH_BOUND}
`,
    });
    expect(errors).toEqual([]);
  });

  it("没有 POST 的端点不在审计范围内", () => {
    const errors = auditRequestBodyBounds({
      "src/app/api/x/route.ts": `
export async function GET(req) {
  const body = await req.json();
  return new Response(String(body));
}
`,
    });
    expect(errors).toEqual([]);
  });

  it("仓库现状：每个 route.ts 都过闸，且确实扫到了接收请求体的端点", () => {
    const root = path.resolve(process.cwd());
    const files = collectRouteFiles(path.join(root, "src/app/api"));
    expect(files.length).toBeGreaterThan(0);
    const sources = Object.fromEntries(
      files.map((full) => [path.relative(root, full), fs.readFileSync(full, "utf8")]),
    );
    const postRoutes = Object.values(sources).filter((src) =>
      src.includes("export async function POST"),
    ).length;
    // 至少覆盖 8 个 AI/auth/error-reports 写端点，防止扫描目录写错导致「零违规」的假绿
    expect(postRoutes).toBeGreaterThanOrEqual(8);
    expect(auditRequestBodyBounds(sources)).toEqual([]);
  });
});
