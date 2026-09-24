import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { auditRequestBodyBounds, collectRouteFiles, MIN_ROUTE_FILES, run } from "./request-body-bounds.mjs";

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

  it("真实 CLI 入口：通过时 exit 不被调用，违规时 exit(1) 并点名文件", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "request-body-bounds-"));
    try {
      const routeDir = path.join(root, "src/app/api/ai/demo");
      fs.mkdirSync(routeDir, { recursive: true });
      fs.writeFileSync(path.join(routeDir, "route.ts"), POST_WITH_BOUND);

      const codes = [];
      const logs = [];
      run({
        rootDir: root,
        minRouteFiles: 1,
        log: (message) => logs.push(String(message)),
        error: () => undefined,
        exit: (value) => codes.push(value),
      });
      expect(codes).toEqual([]);
      expect(logs[0]).toContain("1 个 POST 端点");
      expect(logs[0]).toContain("1 个 route.ts");

      fs.writeFileSync(
        path.join(routeDir, "route.ts"),
        "export async function POST(req) {\n  const body = await req.json();\n  return Response.json(body);\n}\n",
      );
      const errors = [];
      run({
        rootDir: root,
        minRouteFiles: 1,
        log: () => undefined,
        error: (message) => errors.push(String(message)),
        exit: (value) => codes.push(value),
      });
      expect(codes).toEqual([1]);
      expect(errors.join("\n")).toContain("src/app/api/ai/demo/route.ts");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("接口目录不存在时判失败，而不是「0 个端点全部合规」", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "request-body-bounds-empty-"));
    try {
      const codes = [];
      const errors = [];
      run({
        rootDir: root,
        log: () => undefined,
        error: (message) => errors.push(String(message)),
        exit: (value) => codes.push(value),
      });
      expect(codes).toEqual([1]);
      expect(errors.join("\n")).toContain("找不到接口目录");
      // collectRouteFiles 本身仍然返回空数组——坏的是「空集合算通过」这件事，不是遍历
      expect(collectRouteFiles(path.join(root, "src/app/api"))).toEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("扫到的路由少于下限时判失败，并把两个数都念出来", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "request-body-bounds-shrunk-"));
    try {
      const routeDir = path.join(root, "src/app/api/ai/demo");
      fs.mkdirSync(routeDir, { recursive: true });
      fs.writeFileSync(path.join(routeDir, "route.ts"), POST_WITH_BOUND);
      const codes = [];
      const errors = [];
      run({
        rootDir: root,
        minRouteFiles: 5,
        log: () => undefined,
        error: (message) => errors.push(String(message)),
        exit: (value) => codes.push(value),
      });
      expect(codes).toEqual([1]);
      expect(errors.join("\n")).toContain("只扫到 1 个");
      expect(errors.join("\n")).toContain("下限 5");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("仓库现状：route.ts 数量过得了 CLI 用的那个下限", () => {
    const files = collectRouteFiles(path.join(path.resolve(process.cwd()), "src/app/api"));
    expect(files.length).toBeGreaterThanOrEqual(MIN_ROUTE_FILES);
  });
});
