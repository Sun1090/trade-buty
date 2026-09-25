// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { InviteBanner } from "./invite-banner";
import { getDict } from "@/lib/i18n";
import { INVITE_STORAGE_KEY, INVITE_TTL_MS } from "@/lib/invite-ref";
vi.mock("@/lib/growth-events", () => ({ trackGrowthEvent: vi.fn() }));
import { trackGrowthEvent } from "@/lib/growth-events";

const growthTrack = vi.mocked(trackGrowthEvent);

/**
 * R8.5 InviteBanner 单测：
 * - URL ?ref=xxx 时显示 banner
 * - localStorage 已有 invite 时显示 banner
 * - 用户点击 dismiss 后不再显示
 * - 用户点击 clear 后清除 storage 并隐藏
 *
 * 注：测试用 history.replaceState 改 URL 而不是覆写 window.location.search——
 * jsdom 里 .search 是 non-configurable，覆写会抛 TypeError。
 *
 * 末尾另有一组 R16.194：拿**真实字典**渲染，只在「URL 上没有 ref」那个状态下测，
 * 因为 banner 的话必须在那个状态下也成立（记录是 30 天内先前存下的）。
 */

const labels = {
  titleTpl: "Invited by {ref}",
  bodyTpl: "ref is {ref}",
  dismiss: "Got it",
};

const memStore: Record<string, string> = {};

beforeAll(() => {
  // 内存版 localStorage stub（jsdom 30 opaque origin 兜底）
  const stub: Storage = {
    getItem: (k: string) => (k in memStore ? memStore[k] : null),
    setItem: (k: string, v: string) => { memStore[k] = v; },
    removeItem: (k: string) => { delete memStore[k]; },
    clear: () => { for (const k of Object.keys(memStore)) delete memStore[k]; },
    key: (i: number) => Object.keys(memStore)[i] ?? null,
    get length() { return Object.keys(memStore).length; },
  };
  try {
    Object.defineProperty(window, "localStorage", { value: stub, configurable: true, writable: true });
  } catch { /* noop */ }
});

function setSearch(search: string) {
  const qs = search.startsWith("?") ? search : `?${search}`;
  window.history.replaceState(null, "", "/" + qs);
}

beforeEach(() => {
  cleanup();
  growthTrack.mockClear();
  localStorage.clear();
  setSearch("");
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  setSearch("");
});

describe("InviteBanner", () => {
  it("URL 上有 ?ref 时显示 banner", async () => {
    setSearch("?ref=alice");
    render(<InviteBanner labels={labels} locale="en" />);
    const banner = await screen.findByTestId("invite-banner");
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain("alice");
    expect(growthTrack).toHaveBeenCalledWith({
      name: "invite_banner_viewed",
      locale: "en",
      source: "url",
    });
  });

  it("URL 没 ref 但 storage 已有 invite 时显示", async () => {
    const future = Date.now() + 60 * 60 * 1000;
    localStorage.setItem(
      "tb-invite-ref",
      JSON.stringify({ ref: "bob", recordedAt: Date.now(), expiresAt: future }),
    );
    render(<InviteBanner labels={labels} locale="en" />);
    const banner = await screen.findByTestId("invite-banner");
    expect(banner.textContent).toContain("bob");
    expect(growthTrack).toHaveBeenCalledWith({
      name: "invite_banner_viewed",
      locale: "en",
      source: "storage",
    });
  });

  it("无 URL ref 也无 storage 时不显示", async () => {
    render(<InviteBanner labels={labels} locale="en" />);

    expect(screen.queryByTestId("invite-banner")).toBeNull();
  });

  it("点击 dismiss 后不再显示且写入 dismissed 标记", async () => {
    setSearch("?ref=carol");
    render(<InviteBanner labels={labels} locale="en" />);
    await screen.findByTestId("invite-banner");
    fireEvent.click(screen.getByTestId("invite-banner-dismiss"));
    await waitFor(() => {
      expect(screen.queryByTestId("invite-banner")).toBeNull();
    });
    expect(localStorage.getItem("tb-invite-dismissed-carol")).toBe("1");
    expect(growthTrack).toHaveBeenCalledWith({
      name: "invite_banner_dismissed",
      locale: "en",
    });
  });

  it("点击 clear 后清掉 storage 并隐藏", async () => {
    setSearch("?ref=dave");
    render(<InviteBanner labels={labels} locale="en" />);
    await screen.findByTestId("invite-banner");
    fireEvent.click(screen.getByTestId("invite-banner-clear"));
    await waitFor(() => {
      expect(screen.queryByTestId("invite-banner")).toBeNull();
    });
    expect(localStorage.getItem("tb-invite-ref")).toBeNull();
    expect(growthTrack).toHaveBeenCalledWith({
      name: "invite_banner_cleared",
      locale: "en",
    });
  });

  it("zh locale 时 data-locale=zh", async () => {
    setSearch("?ref=eve");
    render(
      <InviteBanner
        labels={{ titleTpl: "邀请 {ref}", bodyTpl: "你被 {ref} 邀请", dismiss: "知道了" }}
        locale="zh"
      />,
    );
    const banner = await screen.findByTestId("invite-banner");
    expect(banner.getAttribute("data-locale")).toBe("zh");
    expect(banner.textContent).toContain("eve");
  });

  it("storage 里的 invite 已过期时不显示", async () => {
    localStorage.setItem(
      "tb-invite-ref",
      JSON.stringify({ ref: "expired", recordedAt: 1, expiresAt: 2 }),
    );
    render(<InviteBanner labels={labels} locale="en" />);

    expect(screen.queryByTestId("invite-banner")).toBeNull();
    expect(localStorage.getItem("tb-invite-ref")).toBeNull();
  });

  it("does not show a previously dismissed invite", async () => {
    setSearch("?ref=frank");
    localStorage.setItem("tb-invite-dismissed-frank", "1");
    render(<InviteBanner labels={labels} locale="en" />);

    expect(screen.queryByTestId("invite-banner")).toBeNull();
  });

  it("syncs visibility and ref changes from storage events", async () => {
    setSearch("?ref=gina");
    render(<InviteBanner labels={labels} locale="en" />);
    await screen.findByTestId("invite-banner");
    localStorage.removeItem("tb-invite-ref");
    fireEvent(window, new StorageEvent("storage", { key: "tb-invite-ref" }));
    await waitFor(() => expect(screen.queryByTestId("invite-banner")).toBeNull());
  });

  it("updates the displayed ref and dismissal target when another tab replaces the invite", async () => {
    setSearch("?ref=gina");
    render(<InviteBanner labels={labels} locale="en" />);
    await screen.findByTestId("invite-banner");
    localStorage.setItem("tb-invite-ref", JSON.stringify({
      ref: "hank", recordedAt: Date.now(), expiresAt: Date.now() + 60_000,
    }));
    fireEvent(window, new StorageEvent("storage", { key: "tb-invite-ref" }));
    expect(screen.getByTestId("invite-banner").textContent).toContain("hank");
    fireEvent.click(screen.getByTestId("invite-banner-dismiss"));
    expect(localStorage.getItem("tb-invite-dismissed-hank")).toBe("1");
    expect(localStorage.getItem("tb-invite-dismissed-gina")).toBeNull();
  });

  it("hides an invite dismissed in another tab", async () => {
    setSearch("?ref=gina");
    render(<InviteBanner labels={labels} locale="en" />);
    await screen.findByTestId("invite-banner");
    localStorage.setItem("tb-invite-dismissed-gina", "1");
    fireEvent(window, new StorageEvent("storage", { key: "tb-invite-dismissed-gina" }));
    expect(screen.queryByTestId("invite-banner")).toBeNull();
  });


  it("does not display a ref that another tab already dismissed", async () => {
    setSearch("?ref=gina");
    render(<InviteBanner labels={labels} locale="en" />);
    await screen.findByTestId("invite-banner");
    localStorage.setItem("tb-invite-dismissed-hank", "1");
    localStorage.setItem("tb-invite-ref", JSON.stringify({
      ref: "hank", recordedAt: Date.now(), expiresAt: Date.now() + 60_000,
    }));
    fireEvent(window, new StorageEvent("storage", { key: "tb-invite-ref" }));
    expect(screen.queryByTestId("invite-banner")).toBeNull();
  });

  it("hides the latest ref when it is dismissed after a cross-tab replacement", async () => {
    setSearch("?ref=gina");
    render(<InviteBanner labels={labels} locale="en" />);
    await screen.findByTestId("invite-banner");
    localStorage.setItem("tb-invite-ref", JSON.stringify({
      ref: "hank", recordedAt: Date.now(), expiresAt: Date.now() + 60_000,
    }));
    fireEvent(window, new StorageEvent("storage", { key: "tb-invite-ref" }));
    localStorage.setItem("tb-invite-dismissed-hank", "1");
    fireEvent(window, new StorageEvent("storage", { key: "tb-invite-dismissed-hank" }));
    expect(screen.queryByTestId("invite-banner")).toBeNull();
  });

});

/**
 * R16.194：这块 banner 原来印的是「来自朋友邀请」「你通过邀请链接进入 Trade Buty」
 * （en "Invited by a friend" / "You arrived via a referral link"）。代码看见的只有一件事：
 * `tb-invite-ref` 里有一条还没过期的记录。它既不认人——`invite-ref.ts` 的 `isValidRef`
 * 只比字符集与长度，仓库里没有任何可供核对的邀请名单——也不看这一次到访：URL 上干干净
 * 净、只留着上月那条记录时 banner 照样挂出来（`invite-banner.tsx` 的 `source: "storage"`
 * 记的就是这一支）。于是「朋友」和「这次通过链接进来」都是没有凭据的断言，而后半句
 * 「一起学起来吧」还把一条本地存储的读数说成了一次关系。
 *
 * 这一组只在**URL 上没有 ref** 的状态下渲染真实字典：那句文案必须在那个状态下也成立。
 * 正锚守住「不许删掉整块来躲检查」，并核对天数取自 `INVITE_TTL_MS`、正文点名的「清除」
 * 这颗按钮真的在同一个 banner 里（R16.193 同族：建议不许指着屏幕上没有的控件）。
 */
describe("R16.194 邀请 banner 说的就是这条本地记录", () => {
  const ttlDays = Math.round(INVITE_TTL_MS / (24 * 60 * 60 * 1000));
  const DAY_MS = 24 * 60 * 60 * 1000;

  it.each([
    {
      locale: "zh" as const,
      names: "邀请参数",
      device: /这台浏览器|本地存储/,
      expires: `${ttlDays} 天`,
      clearLabel: "清除",
      unfounded: /朋友|通过邀请链接|你通过/,
    },
    {
      locale: "en" as const,
      names: "invite parameter",
      device: /this browser|local storage/i,
      expires: `${ttlDays} days`,
      clearLabel: "Clear",
      unfounded: /by a friend|arrived via|referral/i,
    },
  ])("$locale：只有先前存下的记录时，那句话仍只说它看得见的东西", async ({
    locale, names, device, expires, clearLabel, unfounded,
  }) => {
    const recordedAt = Date.now() - 7 * DAY_MS;
    localStorage.setItem(
      INVITE_STORAGE_KEY,
      JSON.stringify({ ref: "bob", recordedAt, expiresAt: recordedAt + INVITE_TTL_MS }),
    );
    render(<InviteBanner labels={getDict(locale).invite} locale={locale} />);
    const banner = await screen.findByTestId("invite-banner");
    const text = banner.textContent ?? "";

    expect(text).toContain("bob");
    expect(text).toContain(names);
    expect(text).toMatch(device);
    expect(text).toContain(expires);
    expect(within(banner).getByRole("button", { name: clearLabel })).toBeInTheDocument();
    expect(text, text).not.toMatch(unfounded);

    // 「不会发送给我们」那一半：本站唯一会带上这个值的通道是本地埋点，它不许携带 ref
    for (const call of growthTrack.mock.calls) {
      expect(JSON.stringify(call[0])).not.toContain("bob");
    }
    expect(growthTrack).toHaveBeenCalled();
  });
});
