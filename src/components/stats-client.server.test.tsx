// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { StatsClient } from "./stats-client";

const chapters = [
  { slug: "getting-started", title: "01 · 入门", tagline: "t", docCount: 2 },
];

const dict = {
  title: "Stats",
  emptyTitle: "Empty",
  emptyBody: "Empty body",
  emptyCta: "Start",
} as unknown as Parameters<typeof StatsClient>[0]["dict"];

/**
 * 统计页的数据全部来自浏览器存储。没有 window 时必须整体退化成「无可渲染内容」，
 * 而不是去碰 localStorage —— 这个页面是预渲染的，服务端抛错就等于构建失败。
 */
describe("StatsClient SSR", () => {
  it("无 window 环境渲染不抛错，且不输出依赖本地存储的内容", () => {
    expect(typeof globalThis.window).toBe("undefined");
    expect(typeof globalThis.localStorage).toBe("undefined");

    const html = renderToString(
      <StatsClient chapters={chapters} dict={dict} locale="zh" />
    );

    expect(html).toBe("");
  });
});
