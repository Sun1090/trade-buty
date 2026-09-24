// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { prepareForRender } from "@/lib/content";
import { READ_ALOUD_CHUNK_CHARS, ReadAloud, speechText } from "./read-aloud";

class FakeUtterance {
  static instances: FakeUtterance[] = [];
  text: string;
  lang = "";
  rate = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
    FakeUtterance.instances.push(this);
  }
}

const speak = vi.fn();
const cancel = vi.fn();

beforeEach(() => {
  FakeUtterance.instances = [];
  speak.mockClear();
  cancel.mockClear();
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  vi.stubGlobal("speechSynthesis", { speak, cancel });
});

describe("ReadAloud", () => {
  it("strips frontmatter and markdown before speaking", () => {
    render(
      <ReadAloud
        text={
          "---\ntitle: x\n---\n# 标题\n正文 **加粗**，门槛、<mark>杠杆</mark>与" +
          "[骗局识别](../pitfalls/scam-detection.md) 都要念\n\n| 列 | 值 |\n|:---|---:|\n| A | 1 |"
        }
        label="朗读"
        playingLabel="停止"
        rateLabel="语速"
        locale="zh"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "朗读" }));
    const utterance = FakeUtterance.instances[0];
    expect(utterance.text).not.toContain("---");
    expect(utterance.text).not.toContain("#");
    expect(utterance.text).not.toContain("*");
    expect(utterance.text).toContain("标题");
    expect(utterance.text).toContain("正文 加粗");
    // 标记的**内容**也不能留下：旧实现只删尖括号，把 <mark> 念成「mark」
    expect(utterance.text).not.toMatch(/<\/?[a-zA-Z]/);
    expect(utterance.text).not.toContain("mark");
    // 链接只念锚文，不念地址
    expect(utterance.text).toContain("骗局识别");
    expect(utterance.text).not.toContain("../pitfalls");
    expect(utterance.text).not.toContain(".md");
    // 表格的分隔行不是话
    expect(utterance.text).not.toContain(":---");
    expect(utterance.text).toContain("列");
  });

  it("A < B 这类比较不会被当成标签吞掉后半句", () => {
    render(
      <ReadAloud
        text="当隐波 < 20% 且估值 > 中位数时进场，成交额 300 万元"
        label="朗读"
        playingLabel="停止"
        rateLabel="语速"
        locale="zh"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "朗读" }));
    expect(FakeUtterance.instances[0].text).toBe(
      "当隐波 < 20% 且估值 > 中位数时进场，成交额 300 万元",
    );
  });

  it("uses the locale language and the selected rate", () => {
    render(
      <ReadAloud
        text="hello"
        label="Read aloud"
        playingLabel="Stop"
        rateLabel="Speaking rate"
        locale="en"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Read aloud" }));
    const utterance = FakeUtterance.instances[0];
    expect(utterance.lang).toBe("en-US");
    expect(utterance.rate).toBe(0.9);
    expect(speak).toHaveBeenCalledWith(utterance);
    // 英文界面上的语速提示也必须是英文（R16.50：这里曾经写死 title="语速"）
    expect(screen.getByTitle("Speaking rate")).toBeInTheDocument();
    expect(screen.queryByTitle("语速")).not.toBeInTheDocument();
  });

  it("switches the button to the playing label and cancels on the second press", () => {
    render(
      <ReadAloud text="hello" label="朗读" playingLabel="停止" rateLabel="语速" locale="zh" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "朗读" }));
    const stop = screen.getByRole("button", { name: "停止" });
    expect(stop.textContent).toContain("🔊");

    fireEvent.click(stop);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "朗读" })).toBeInTheDocument();
  });

  it("returns to idle when the utterance ends", () => {
    render(
      <ReadAloud text="hello" label="朗读" playingLabel="停止" rateLabel="语速" locale="zh" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "朗读" }));
    const utterance = FakeUtterance.instances[0];
    act(() => {
      utterance.onend?.();
    });
    expect(screen.getByRole("button", { name: "朗读" })).toBeInTheDocument();
  });

  it("cycles the speaking rate", () => {
    render(
      <ReadAloud text="hello" label="朗读" playingLabel="停止" rateLabel="语速" locale="zh" />,
    );
    const rate = screen.getByTitle("语速");
    expect(rate.textContent).toBe("0.9×");
    fireEvent.click(rate);
    expect(rate.textContent).toBe("1×");
    fireEvent.click(rate);
    expect(rate.textContent).toBe("1.2×");
    fireEvent.click(rate);
    expect(rate.textContent).toBe("0.8×");
  });

  it("长课文整篇排队念，不再只交前 3000 字（R16.50）", () => {
    // 182 篇中文课里 173 篇超过 3000 字：那个上限管的是每条 utterance，不是课文本身，
    // 否则按钮写着「朗读」，后半篇根本没进引擎。
    const lesson = Array.from(
      { length: 5 },
      (_, i) => `第${i}段\n${"字".repeat(1500)}`,
    ).join("\n\n");
    render(
      <ReadAloud
        text={lesson}
        label="朗读"
        playingLabel="停止"
        rateLabel="语速"
        locale="zh"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "朗读" }));
    const spoken = FakeUtterance.instances.map((u) => u.text).join("");
    expect(FakeUtterance.instances.length).toBeGreaterThan(1);
    expect(spoken.length).toBeGreaterThan(READ_ALOUD_CHUNK_CHARS);
    expect(spoken.replace(/\n/g, "")).toBe(lesson.replace(/\n/g, ""));
    for (const utterance of FakeUtterance.instances) {
      expect(utterance.text.length).toBeLessThanOrEqual(READ_ALOUD_CHUNK_CHARS);
    }
  });

  it("只有队尾那条念完才回到待命，中间一条念完不算", () => {
    const lesson = `第一段\n${"字".repeat(2500)}\n\n第二段\n${"字".repeat(2500)}`;
    render(
      <ReadAloud
        text={lesson}
        label="朗读"
        playingLabel="停止"
        rateLabel="语速"
        locale="zh"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "朗读" }));
    expect(FakeUtterance.instances.length).toBe(2);
    act(() => {
      FakeUtterance.instances[0].onend?.();
    });
    expect(screen.getByRole("button", { name: "停止" })).toBeInTheDocument();
    act(() => {
      FakeUtterance.instances[1].onend?.();
    });
    expect(screen.getByRole("button", { name: "朗读" })).toBeInTheDocument();
  });
});

describe("朗读的课文与屏幕上的课文同源", () => {
  // prepareForRender 之后仍然带标记：内联 <mark>、表格分隔行、链接地址。
  // 朗读拿的是这一份字符串，所以每一篇都要念得出口——不数「有多少处噪音」，
  // 而是要求整棵内容树里一处都没有。
  const KB_ROOT = "content/kline-buty/docs/knowledge";
  const NOISE: [string, RegExp][] = [
    // 判据必须与「清得干不干净」无关地成立：`K1<K2` 这种比较不是标签，
    // 「详见 cash-flow-analysis.md」里的 .md 是屏幕上真的写着的内容，念出来不算噪音。
    // 而按标签名与收尾斜杠认，则连「只删尖括号、留下 mark 这个词」的旧实现也躲不过。
    ["还剩收尾标签", /<\/[a-zA-Z]/],
    ["还剩标签名", /<(?:abbr|a|blockquote|br|code|div|details|em|h[1-6]|img|kbd|li|mark|ol|p|span|strong|sub|summary|sup|table|tbody|td|th|thead|ul)\b/],
    ["还剩链接地址", /\]\(/],
    ["还剩表格分隔行或横线", /^\s*:?-{3,}[-:\s|]*$/m],
    ["还剩未改写的资产路径", /_assets|\.\.\/\.\.\//],
  ];

  function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (e.name.endsWith(".md")) out.push(p);
    }
    return out;
  }

  it("整棵内容树的朗读文本里一处标记噪音都没有", () => {
    const files = walk(KB_ROOT).filter((f) => /^(zh|en)\//.test(f.slice(KB_ROOT.length + 1)));
    expect(files.length, "扫描到的课文数量变少 = 这道检查瞎了").toBeGreaterThanOrEqual(400);
    const hits: string[] = [];
    for (const f of files) {
      const rel = f.slice(KB_ROOT.length + 1);
      const [locale, chapter] = rel.split("/");
      const raw = fs.readFileSync(f, "utf8").replace(/^---[\s\S]*?---\n/, "");
      const spoken = speechText(prepareForRender(raw, locale, chapter));
      for (const [name, re] of NOISE) {
        const m = spoken.match(re);
        if (m) hits.push(`${rel} ${name}: ${JSON.stringify(spoken.slice(Math.max(0, (m.index ?? 0) - 12), (m.index ?? 0) + 18))}`);
      }
    }
    expect(hits, `朗读文本里还剩标记：\n${hits.slice(0, 12).join("\n")}`).toEqual([]);
  });
});
