// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ReadAloud } from "./read-aloud";

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
        locale="en"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Read aloud" }));
    const utterance = FakeUtterance.instances[0];
    expect(utterance.lang).toBe("en-US");
    expect(utterance.rate).toBe(0.9);
    expect(speak).toHaveBeenCalledWith(utterance);
  });

  it("switches the button to the playing label and cancels on the second press", () => {
    render(
      <ReadAloud text="hello" label="朗读" playingLabel="停止" locale="zh" />,
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
      <ReadAloud text="hello" label="朗读" playingLabel="停止" locale="zh" />,
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
      <ReadAloud text="hello" label="朗读" playingLabel="停止" locale="zh" />,
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

  it("truncates very long text to 3000 characters", () => {
    render(
      <ReadAloud
        text={"a".repeat(5000)}
        label="朗读"
        playingLabel="停止"
        locale="zh"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "朗读" }));
    expect(FakeUtterance.instances[0].text.length).toBe(3000);
  });
});
