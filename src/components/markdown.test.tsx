// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Markdown } from "./markdown";
import { prepareForRender } from "@/lib/content";

describe("Markdown", () => {
  it("渲染段落", () => {
    render(<Markdown content="这是普通段落" />);
    expect(screen.getByText("这是普通段落")).toBeInTheDocument();
  });

  it("渲染 H2", () => {
    const { container } = render(<Markdown content="## 标题" />);
    expect(container.querySelector("h2")).toBeTruthy();
  });

  it("渲染代码块", () => {
    const { container } = render(<Markdown content={"```js\nconsole.log(1)\n```"} />);
    expect(container.textContent).toContain("console.log");
    const badge = container.querySelector("pre + span, div.relative > span");
    expect(badge?.textContent).toBe("js");
    expect(badge?.className).toContain("text-muted");
  });

  it("外链加 target=_blank", () => {
    const { container } = render(<Markdown content="[Google](https://google.com)" />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("target")).toBe("_blank");
  });

  it("内链不加 target=_blank", () => {
    const { container } = render(<Markdown content="[课](/knowledge/spot)" />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("target")).toBeNull();
  });

  /**
   * R16.296：locale 前缀只认本仓真实有的那两个。
   *
   * 原先的正则写 `[a-z]{2}`，于是 `/xyknowledge/spot` 也会被当成站内链接渲染成 `<Link>`。
   * 这一点本轮**实测过危害到底有没有到崩溃**：在 jsdom 里渲染旧写法不抛错，所以别把它
   * 写成「一个坏链接就能把整页带崩」——那是没验就下的结论（写下这行时正是如此）。
   * 真正的后果更朴素也更确定：这样的链接被**静默当成站内地址**，而它其实什么站内页面都
   * 不是；点下去要么 404、要么被 Next 的 locale 重定向逻辑卷进去。
   * 判据只说它自己证明得了的那件事——「不认得的 locale 一律按普通链接处理」——
   * 至于那样做在生产里到底落到哪一页，不在这里猜。
   */
  it("locale 前缀只认本仓真实有的 zh/en，别的前缀不当站内路由", () => {
    for (const locale of ["zh", "en"]) {
      const { container, unmount } = render(
        <Markdown content={`[课](/${locale}/knowledge/spot/spot-basics)`} />,
      );
      const link = container.querySelector("a");
      expect(link?.getAttribute("target"), `${locale} 前缀被当外链了`).toBeNull();
      expect(link?.getAttribute("href")).toBe(`/${locale}/knowledge/spot/spot-basics`);
      unmount();
    }
    for (const bogus of ["xy", "zz", "qq"]) {
      const { container, unmount } = render(
        <Markdown content={`[课](/${bogus}knowledge/spot/spot-basics)`} />,
      );
      const link = container.querySelector("a");
      expect(
        link?.getAttribute("target"),
        `/${bogus}knowledge/… 仍被当成站内路由，会在渲染期抛错`,
      ).toBe("_blank");
      unmount();
    }
  });

  it("rewriteLinks 加了 locale 前缀的站内地址不算外链", () => {
    // 生产者（rewriteLinks）与消费者（isInternal）必须对同一个形状达成一致：
    // 课文里写 [坑](../pitfalls/)，落到页面上是 /zh/knowledge/pitfalls。
    const prepared = prepareForRender("[坑](../pitfalls/)", "zh", "getting-started");
    expect(prepared).toContain("](/zh/knowledge/pitfalls)");
    const { container } = render(<Markdown content={prepared} />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/zh/knowledge/pitfalls");
    expect(link?.getAttribute("target"), "站内链不该开新标签").toBeNull();
    expect(link?.textContent, "站内链不该挂外链标记 ↗").toBe("坑");
  });

  it("en 的站内地址同样留在本页", () => {
    const prepared = prepareForRender("[basics](./spot-basics.md)", "en", "spot");
    expect(prepared).toContain("](/en/knowledge/spot/spot-basics)");
    const { container } = render(<Markdown content={prepared} />);
    expect(container.querySelector("a")?.getAttribute("target")).toBeNull();
  });

  it("页内 #锚点 不开新标签", () => {
    const { container } = render(<Markdown content="[跳到第二节](#第二节)" />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("target")).toBeNull();
    expect(link?.textContent).toBe("跳到第二节");
  });
});

describe("R7.2 图片懒加载", () => {
  it("img 渲染带 loading=lazy，alt 原样落地", () => {
    const { container } = render(<Markdown content="![示例](/knowledge-assets/x.png)" />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("loading")).toBe("lazy");
    expect(img?.getAttribute("alt")).toBe("示例");
  });

  it("课程图片可按键盘打开，并保留 alt 作为可访问名称", () => {
    const { container } = render(
      <Markdown
        content="![走势图](/knowledge-assets/x.png)"
        interactiveImages
        interactiveImageLabel="打开大图"
      />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("role")).toBe("button");
    expect(img?.getAttribute("tabindex")).toBe("0");
    expect(img?.getAttribute("aria-haspopup")).toBe("dialog");
    expect(img?.getAttribute("aria-label")).toBeNull();
    expect(screen.getByRole("button", { name: "走势图" })).toBe(img);
  });

  it("空 alt 课程图片使用本地化打开标签", () => {
    render(
      <Markdown
        content="![](/knowledge-assets/x.png)"
        interactiveImages
        interactiveImageLabel="打开大图"
      />,
    );
    expect(screen.getByRole("button", { name: "打开大图" })).toBeInTheDocument();
  });

  it("GFM 任务清单的复选框通过包裹 label 获得可访问名称（R16.283 追扫）", () => {
    const { container } = render(
      <Markdown content={"- [ ] 爆仓后立刻开新仓\n- [x] 设好的止损\n"} />,
    );
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    for (const box of boxes) {
      expect(box).toHaveAccessibleName();
    }
    // 包裹关系是关联的来源：input 必须是 label 的后代，而不是裸兄弟
    for (const box of boxes) {
      expect(box.closest("label")).not.toBeNull();
      expect(box.closest("label")).toHaveTextContent(/爆仓后|止损/);
    }
    expect(container.querySelectorAll(".task-list-item")).toHaveLength(2);
  });

  it("普通清单项不包 label（不做无谓的包裹）", () => {
    const { container } = render(<Markdown content={"- 普通条目\n"} />);
    expect(container.querySelector("label")).toBeNull();
  });

  it("GFM 表格的空角落 th 降级为 td（axe empty-table-header：读屏无法命名空列头）", () => {
    const { container } = render(
      <Markdown content={"| | 亏 | 盈 |\n| --- | --- | --- |\n| 例子 | 1 | 2 |\n"} />,
    );
    const ths = container.querySelectorAll("th");
    expect(ths).toHaveLength(2);
    for (const th of ths) expect(th).toHaveTextContent(/亏|盈/);
    // 空角落不再以 th 形态出现——它本来就是占位
    expect(container.querySelectorAll("thead th")).toHaveLength(2);
    expect(container.querySelectorAll("thead td")).toHaveLength(1);
    const tds = container.querySelectorAll("tbody td");
    expect(tds).toHaveLength(3);
  });
});
