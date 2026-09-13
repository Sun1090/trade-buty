// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Toc } from "./toc";
import type { TocItem } from "@/lib/toc";

describe("Toc", () => {
  const items: TocItem[] = [
    { text: "第一节", depth: 2, id: "section-1" },
    { text: "子节", depth: 3, id: "subsection" },
    { text: "第二节", depth: 2, id: "section-2" },
  ];

  it("渲染导航标签", () => {
    render(<Toc items={items} heading="目录" />);
    expect(screen.getByText("目录")).toBeInTheDocument();
  });

  it("渲染所有标题链接", () => {
    const { container } = render(<Toc items={items} heading="目录" />);
    const links = container.querySelectorAll("nav a");
    expect(links.length).toBe(3);
    expect(links[0].textContent).toBe("第一节");
    expect(links[1].textContent).toBe("子节");
    expect(links[2].textContent).toBe("第二节");
  });

  it("少于 3 项不渲染", () => {
    const { container } = render(
      <Toc items={[{ text: "仅一项", depth: 2, id: "one" }]} heading="目录" />
    );
    expect(container.querySelector("nav")).toBeNull();
  });

  it("链接 href 含 #id", () => {
    const { container } = render(<Toc items={items} heading="目录" />);
    const link = container.querySelectorAll("nav a")[0];
    expect(link?.getAttribute("href")).toBe("#section-1");
  });
});

describe("Toc mobile dialog", () => {
  const items: TocItem[] = [
    { text: "第一节", depth: 2, id: "section-1" },
    { text: "子节", depth: 3, id: "subsection" },
    { text: "第二节", depth: 2, id: "section-2" },
  ];

  it("打开后聚焦首项，Escape 关闭并归还焦点", async () => {
    render(<Toc items={items} heading="目录" />);
    const trigger = screen.getByRole("button", { name: "目录" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "目录" });
    const firstLink = within(dialog).getByRole("link", { name: "第一节" });
    await waitFor(() => expect(firstLink).toHaveFocus());

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  observed: HTMLElement[] = [];
  disconnected = false;
  root = null;
  rootMargin = "0px";
  thresholds: number[] = [];

  constructor(private readonly cb: IntersectionObserverCallback) {
    MockIntersectionObserver.instances.push(this);
  }

  observe(el: HTMLElement) {
    this.observed.push(el);
  }

  unobserve() {}

  disconnect() {
    this.disconnected = true;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  trigger(entries: Array<{ target: HTMLElement; top: number }>) {
    this.cb(
      entries.map(
        ({ target, top }) =>
          ({
            target,
            isIntersecting: true,
            boundingClientRect: { top } as DOMRectReadOnly,
          }) as unknown as IntersectionObserverEntry,
      ),
      this as unknown as IntersectionObserver,
    );
  }
}

describe("Toc 联动与交互", () => {
  const items: TocItem[] = [
    { text: "第一节", depth: 2, id: "section-1" },
    { text: "子节", depth: 3, id: "subsection" },
    { text: "第二节", depth: 2, id: "section-2" },
  ];

  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    for (const item of items) {
      const el = document.createElement("h2");
      el.id = item.id;
      el.scrollIntoView = vi.fn();
      document.body.appendChild(el);
    }
  });

  afterEach(() => {
    for (const item of items) document.getElementById(item.id)?.remove();
    vi.unstubAllGlobals();
  });

  it("观察全部标题，并对最靠上的可见项高亮", () => {
    const { container } = render(<Toc items={items} heading="目录" />);
    const io = MockIntersectionObserver.instances[0];

    expect(io.observed.map((el) => el.id)).toEqual(items.map((i) => i.id));

    act(() => {
      io.trigger([
        { target: document.getElementById("section-2") as HTMLElement, top: 40 },
        { target: document.getElementById("section-1") as HTMLElement, top: 10 },
      ]);
    });

    const links = container.querySelectorAll("nav a");
    expect(links[0].className).toContain("text-accent");
    expect(links[2].className).not.toContain("text-accent");
  });

  it("卸载时断开观察避免泄漏", () => {
    const { unmount } = render(<Toc items={items} heading="目录" />);
    const io = MockIntersectionObserver.instances[0];

    unmount();

    expect(io.disconnected).toBe(true);
  });

  it("没有目录项时不创建观察器", () => {
    const { container } = render(<Toc items={[]} heading="目录" />);

    expect(container.querySelector("nav")).toBeNull();
    expect(MockIntersectionObserver.instances).toHaveLength(0);
  });

  it("点击目录项平滑滚动到目标并高亮", () => {
    const { container } = render(<Toc items={items} heading="目录" />);
    const target = document.getElementById("section-2") as HTMLElement;
    const link = container.querySelectorAll("nav a")[2];

    fireEvent.click(link);

    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" });
    expect(link.className).toContain("text-accent");
  });

  it("抽屉内点击目录项后关闭抽屉", async () => {
    render(<Toc items={items} heading="目录" />);
    fireEvent.click(screen.getByRole("button", { name: "目录" }));
    const dialog = screen.getByRole("dialog", { name: "目录" });

    fireEvent.click(within(dialog).getByRole("link", { name: "第一节" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("点击遮罩关闭抽屉", async () => {
    render(<Toc items={items} heading="目录" />);
    fireEvent.click(screen.getByRole("button", { name: "目录" }));
    const dialog = screen.getByRole("dialog", { name: "目录" });

    fireEvent.click(dialog.previousElementSibling as Element);

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
