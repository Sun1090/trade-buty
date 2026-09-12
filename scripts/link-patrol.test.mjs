import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  checkExternalLink,
  extractExternalLinks,
  listMarkdownFiles,
  patrolExternalLinks,
  run,
} from "./link-patrol.mjs";

const SCRIPT = fileURLToPath(new URL("./link-patrol.mjs", import.meta.url));
const tempDirs = [];

function makeRepo(lessons = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "trade-buty-link-patrol-"));
  tempDirs.push(root);
  const kbDir = path.join(root, "content", "kline-buty", "docs", "knowledge");
  fs.mkdirSync(kbDir, { recursive: true });
  for (const [name, source] of Object.entries(lessons)) {
    const file = path.join(kbDir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, source);
  }
  return { root, kbDir };
}

function runCli(root, env = {}) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT], {
      cwd: root,
      env: { ...process.env, LINK_PATROL_ALLOW_EMPTY: "", ...env },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, output: stdout };
  } catch (error) {
    return { status: error.status, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("link patrol extraction", () => {
  it("deduplicates http(s) links and keeps the first Markdown source", () => {
    const links = extractExternalLinks([
      {
        file: "knowledge/zh/a.md",
        source:
          "[one](https://example.com/path). [duplicate](https://example.com/path)\n" +
          "[legacy](http://legacy.example/path,)",
      },
    ]);

    expect([...links.keys()]).toEqual([
      "https://example.com/path",
      "http://legacy.example/path",
    ]);
    expect(links.get("https://example.com/path")).toBe("knowledge/zh/a.md");
  });

  it("recursively finds Markdown files without picking up other assets", () => {
    const { kbDir } = makeRepo({
      "a.md": "# A\n",
      "nested/b.md": "# B\n",
      "nested/readme.txt": "not markdown\n",
    });

    expect(listMarkdownFiles(kbDir).map((file) => path.relative(kbDir, file)).sort()).toEqual([
      "a.md",
      "nested/b.md",
    ]);
  });
});

describe("link patrol HTTP checks", () => {
  it("accepts a healthy HEAD response", async () => {
    const calls = [];
    const result = await checkExternalLink("https://healthy.example", {
      fetchImpl: async (_url, options) => {
        calls.push(options.method);
        return { status: 200 };
      },
    });

    expect(result).toBeNull();
    expect(calls).toEqual(["HEAD"]);
  });

  it("falls back to GET when HEAD is forbidden", async () => {
    const calls = [];
    const result = await checkExternalLink("https://head-forbidden.example", {
      fetchImpl: async (_url, options) => {
        calls.push(options.method);
        return { status: options.method === "HEAD" ? 405 : 200 };
      },
    });

    expect(result).toBeNull();
    expect(calls).toEqual(["HEAD", "GET"]);
  });

  it("retries transient network failures", async () => {
    let calls = 0;
    const result = await checkExternalLink("https://flaky.example", {
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) throw new Error("ECONNRESET");
        return { status: 200 };
      },
    });

    expect(result).toBeNull();
    expect(calls).toBe(2);
  });

  it("reports a persistent timeout in a stable form", async () => {
    const result = await checkExternalLink("https://slow.example", {
      timeoutMs: 1_000,
      fetchImpl: async () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      },
    });

    expect(result).toBe("timeout(1s)");
  });

  it("returns the failed HTTP method and status without retrying", async () => {
    let calls = 0;
    const result = await checkExternalLink("https://broken.example", {
      fetchImpl: async () => {
        calls += 1;
        return { status: 503 };
      },
    });

    expect(result).toBe("HEAD 503");
    expect(calls).toBe(1);
  });
});

describe("link patrol falsifiable inputs", () => {
  it("fails when the knowledge submodule directory is missing", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "trade-buty-link-patrol-"));
    tempDirs.push(root);
    const result = await patrolExternalLinks({ root, kbDir: path.join(root, "missing") });

    expect(result.errors.join("\n")).toContain("git submodule update --init --recursive");
  });

  it("fails when the directory exists but has no Markdown", async () => {
    const { root, kbDir } = makeRepo();
    const result = await patrolExternalLinks({ root, kbDir });

    expect(result.files).toEqual([]);
    expect(result.errors.join("\n")).toContain("没有 Markdown 文件");
  });

  it("fails on a zero-link corpus unless the operator explicitly allows it", async () => {
    const { root, kbDir } = makeRepo({ "a.md": "# A\nNo links here.\n" });

    const strict = await patrolExternalLinks({ root, kbDir });
    expect(strict.errors.join("\n")).toContain("LINK_PATROL_ALLOW_EMPTY=1");

    const allowed = await patrolExternalLinks({ root, kbDir, allowEmpty: true });
    expect(allowed.errors).toEqual([]);
    expect(allowed.links.size).toBe(0);
  });

  it("checks every unique link and reports the source of broken ones", async () => {
    const { root, kbDir } = makeRepo({
      "a.md": "[ok](https://ok.example)\n[bad](https://bad.example)\n",
      "b.md": "[duplicate](https://ok.example)\n",
    });
    const checked = [];
    const result = await patrolExternalLinks({
      root,
      kbDir,
      check: async (url) => {
        checked.push(url);
        return url.includes("bad") ? "HEAD 500" : null;
      },
    });

    expect(checked.sort()).toEqual(["https://bad.example", "https://ok.example"]);
    expect(result.broken).toEqual([
      "content/kline-buty/docs/knowledge/a.md  HEAD 500  https://bad.example",
    ]);
  });

  it("checks real HTTP responses and returns a failing exit code for a broken link", async () => {
    const server = http.createServer((request, response) => {
      if (request.url === "/ok") {
        response.writeHead(200);
      } else {
        response.writeHead(404);
      }
      response.end();
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const { root, kbDir } = makeRepo({
      "a.md": `[ok](http://127.0.0.1:${port}/ok)\n[bad](http://127.0.0.1:${port}/missing)\n`,
    });
    const stdout = [];
    const stderr = [];

    try {
      const code = await run({
        root,
        kbDir,
        stdout: (line) => stdout.push(line),
        stderr: (line) => stderr.push(line),
      });
      expect(code).toBe(1);
      expect(stderr.join("\n")).toContain("HEAD 404");
      expect(stderr.join("\n")).toContain(`http://127.0.0.1:${port}/missing`);
    } finally {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});

describe("link patrol CLI", () => {
  it("turns an empty link set into a nonzero exit by default", () => {
    const { root } = makeRepo({ "a.md": "# A\nNo links here.\n" });
    const result = runCli(root);

    expect(result.status).toBe(1);
    expect(result.output).toContain("LINK_PATROL_ALLOW_EMPTY=1");
  });

  it("requires the explicit empty-set override to pass", () => {
    const { root } = makeRepo({ "a.md": "# A\nNo links here.\n" });
    const result = runCli(root, { LINK_PATROL_ALLOW_EMPTY: "1" });

    expect(result.status).toBe(0);
    expect(result.output).toContain("显式放行空集");
  });

  it("exits nonzero with an initialization hint when the submodule is absent", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "trade-buty-link-patrol-"));
    tempDirs.push(root);
    const result = runCli(root);

    expect(result.status).toBe(1);
    expect(result.output).toContain("git submodule update --init --recursive");
  });
});
