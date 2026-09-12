import { describe, expect, it } from "vitest";
import { extractJsonBlock, parseJsonLoose } from "./json-extract";

describe("parseJsonLoose (R7.12)", () => {
  it("解析本身就是合法 JSON 的输出", () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonLoose("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("剥掉 ```json 围栏", () => {
    const raw = '```json\n{"plan":"先复习错题"}\n```';
    expect(parseJsonLoose<{ plan: string }>(raw)?.plan).toBe("先复习错题");
  });

  it("剥掉无语言标记的围栏", () => {
    const raw = '```\n{"a":true}\n```';
    expect(parseJsonLoose(raw)).toEqual({ a: true });
  });

  it("忽略 JSON 前后的解释性文字", () => {
    const raw = '好的，这是结果：\n{"questions":[{"q":"1"}]}\n希望有帮助！';
    expect(parseJsonLoose<{ questions: unknown[] }>(raw)?.questions).toHaveLength(1);
  });

  it("容忍末尾多余逗号", () => {
    expect(parseJsonLoose('{"a":1,}')).toEqual({ a: 1 });
    expect(parseJsonLoose('{"a":[1,2,],}')).toEqual({ a: [1, 2] });
  });

  it("字符串里的花括号/逗号不会被误判", () => {
    const raw = '说明：{"a":"包含 } 和 , 的文本","b":{"c":1}}';
    expect(parseJsonLoose<{ a: string; b: { c: number } }>(raw)).toEqual({
      a: "包含 } 和 , 的文本",
      b: { c: 1 },
    });
  });

  it("转义引号不会被当成字符串结束", () => {
    const raw = String.raw`{"a":"say \"hi\"","b":2}`;
    expect(parseJsonLoose<{ a: string; b: number }>(raw)).toEqual({ a: 'say "hi"', b: 2 });
  });

  it("纯文本 / 空串 / 残缺 JSON 返回 null", () => {
    expect(parseJsonLoose("")).toBeNull();
    expect(parseJsonLoose("这是一段普通回答，没有 JSON。")).toBeNull();
    expect(parseJsonLoose('{"a":1')).toBeNull();
    expect(parseJsonLoose('{"a": "未闭合')).toBeNull();
    expect(parseJsonLoose("}]}")).toBeNull();
  });

  it("非字符串输入返回 null 不抛错", () => {
    expect(parseJsonLoose(null as unknown as string)).toBeNull();
    expect(parseJsonLoose(undefined as unknown as string)).toBeNull();
  });
});

describe("extractJsonBlock", () => {
  it("返回最外层配对区间", () => {
    expect(extractJsonBlock('前言 {"a":{"b":1}} 后记')).toBe('{"a":{"b":1}}');
    expect(extractJsonBlock("前言 [1,[2]] 后记")).toBe("[1,[2]]");
  });

  it("围栏优先于正文里的其他括号", () => {
    const raw = '注意（见 [1]）\n```json\n{"a":1}\n```';
    expect(extractJsonBlock(raw)).toBe('{"a":1}');
  });

  it("无 JSON 时返回 null", () => {
    expect(extractJsonBlock("没有结构")).toBeNull();
  });
});
