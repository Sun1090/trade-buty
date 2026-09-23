// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { READ_ALOUD_CHUNK_CHARS, ReadAloud } from "./read-aloud";

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
        text={"---\ntitle: x\n---\n# 标题\n正文 **加粗**"}
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
