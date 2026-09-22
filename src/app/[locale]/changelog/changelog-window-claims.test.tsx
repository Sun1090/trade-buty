// @vitest-environment jsdom
/**
 * `/[locale]/changelog` 是预渲染的静态 HTML，且整份发布记录会一次性列在页面上：
 * 每发一版页面就长一截，路由体积预算迟早被发布次数本身撑破（0.7.9 就是这样把
 * zh/changelog 的 HTML 顶到 45.7KB / 预算 45KB 的）。页面改成只列最近 N 版并指向
 * CHANGELOG.md 之后，「只列最近 N 个」「更早的 M 个」这两句话必须由同一份数据算出来。
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  CHANGELOG_WINDOW,
  changelogSurface,
  releaseNotes,
} from "@/lib/release-notes";
import { REPOSITORY_URL } from "@/lib/site";

import ChangelogPage from "./page";

function props(locale: "zh" | "en"): PageProps<"/[locale]/changelog"> {
  return {
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve({}),
  };
}

let shown: { unmount: () => void } | null = null;

interface Rendered {
  text: string;
  versions: string[];
  changelogLinks: string[];
}

async function renderPage(locale: "zh" | "en"): Promise<Rendered> {
  shown?.unmount();
  const view = render(
    (await ChangelogPage(props(locale))) as ReactElement,
  ) as unknown as {
    unmount: () => void;
    baseElement: HTMLElement;
    container: HTMLElement;
  };
  shown = view;
  const nodes = Array.from(
    view.container.querySelectorAll<HTMLElement>("[id]"),
  );
  return {
    text: view.baseElement.textContent ?? "",
    versions: nodes
      .map((n) => /^changelog-(\d+\.\d+\.\d+)$/.exec(n.id)?.[1])
      .filter((v): v is string => v !== undefined),
    changelogLinks: Array.from(
      view.container.querySelectorAll<HTMLAnchorElement>('a[href*="CHANGELOG.md"]'),
    ).map((a) => a.getAttribute("href") ?? ""),
  };
}

const { shown: shownReleases, older } = changelogSurface();

describe("更新日志页关于自己列了哪些版本的两句话", () => {
  it("页面渲染的版本就是窗口内那批，一条不多一条不少", async () => {
    const { versions } = await renderPage("zh");
    expect(versions).toEqual(shownReleases.map((r) => r.version));
    expect(versions.length).toBeLessThanOrEqual(CHANGELOG_WINDOW);
    // 全量渲染的旧写法会在这里露馅：页面少了 older 那几条
    expect(versions.length).toBe(releaseNotes.length - older.length);
  });

  it("被折叠掉的版本不再出现在页面上，窗口内的版本标题都在", async () => {
    const { text } = await renderPage("zh");
    for (const release of shownReleases) {
      expect(text, `v${release.version} 应当可见`).toContain(release.name.zh);
    }
    // 探针只能取版本标题：新版本正文里本来就会提到旧版本号（0.7.2 那条写着
    // 「0.4.0–0.7.0 属门禁上线前的遗留」），拿版本字符串做「不该出现」的判断会误伤。
    for (const release of older) {
      expect(text, `v${release.version} 已被折叠`).not.toContain(release.name.zh);
    }
  });

  it("「更早的 M 个版本」里的 M 是真数，两种语言都给出 CHANGELOG.md 链接", async () => {
    for (const locale of ["zh", "en"] as const) {
      const { text, changelogLinks } = await renderPage(locale);
      expect(changelogLinks).toEqual([`${REPOSITORY_URL}/blob/main/CHANGELOG.md`]);
      const claim =
        locale === "zh"
          ? `更早的 ${older.length} 个版本完整记录在`
          : `the earlier ${older.length} are recorded in`;
      expect(text).toContain(claim);
      // 句子写出的窗口大小也得和真实窗口一致
      expect(text).toContain(
        locale === "zh"
          ? `本页只列最近 ${CHANGELOG_WINDOW} 个版本`
          : `the most recent ${CHANGELOG_WINDOW} releases`,
      );
    }
  });

  it("这批断言不是空转：数据确实多到需要折叠", () => {
    expect(releaseNotes.length, "发布记录不足以折叠，请重看这几条断言").toBeGreaterThan(
      CHANGELOG_WINDOW,
    );
    expect(older.length).toBeGreaterThan(0);
    expect(shownReleases.length).toBe(CHANGELOG_WINDOW);
    // 顺序：页面列出的第一批必须是最新版本
    expect(shownReleases[0].version).toBe(releaseNotes[0].version);
  });
});
