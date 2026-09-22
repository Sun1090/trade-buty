// @vitest-environment jsdom
/**
 * FAQ「数据安全吗？」回答的是「服务器上可能存在哪些内容」，隐私政策是这件事的详细版。
 * 两处原先各说各的：FAQ 数了三类（登录邮箱、同步进度、AI 匿名记录）就收尾，而隐私页
 * 明确写了崩溃诊断会写入短期服务端日志。问 FAQ 的人据此会以为服务器上除了那三类什么
 * 都没有。这里要求两页对同一件事给出同一份清单，并保留旧写法作为禁令的自证。
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

import FaqPage from "./page";
import PrivacyPage from "../privacy/page";

function faqProps(locale: "zh" | "en"): PageProps<"/[locale]/faq"> {
  return {
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve({}),
  };
}

function privacyProps(locale: "zh" | "en"): PageProps<"/[locale]/privacy"> {
  return {
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve({}),
  };
}

async function faqAnswer(locale: "zh" | "en"): Promise<string> {
  const view = render((await FaqPage(faqProps(locale))) as ReactElement) as unknown as {
    container: HTMLElement;
    unmount: () => void;
  };
  const question = locale === "zh" ? "数据安全吗？" : "Is my data safe?";
  const card = Array.from(view.container.querySelectorAll("li")).find((item) =>
    (item.textContent ?? "").includes(question)
  );
  const text = card?.textContent ?? "";
  view.unmount();
  expect(text, `FAQ 里找不到「${question}」`).not.toBe("");
  return text;
}

async function privacyText(locale: "zh" | "en"): Promise<string> {
  const view = render(
    (await PrivacyPage(privacyProps(locale))) as ReactElement
  ) as unknown as { baseElement: HTMLElement; unmount: () => void };
  const text = view.baseElement.textContent ?? "";
  view.unmount();
  return text;
}

/** 崩溃诊断那句话在两页都得在：它不是「细节」，它是清单的一项 */
const LOG_CLAIM = /短期服务端日志|short-lived (?:server )?logs/i;
/** 禁令自证：旧 FAQ 答案数完三类就收尾，压根不提日志 */
const LEGACY_FAQ_ANSWER =
  "不收集追踪数据、没有追踪 cookie。服务器上可能存在三类内容：登录邮箱（Supabase Auth）、你选择同步的学习进度（Supabase Postgres，受 RLS 行级安全保护），以及 AI 回答评分与引用点击产生的匿名记录（不关联账户）。细节见隐私政策。";

describe("FAQ 与隐私页对「服务器上有什么」说同一份清单", () => {
  it("禁令抓得住旧答案", () => {
    expect(
      LOG_CLAIM.test(LEGACY_FAQ_ANSWER),
      "旧写法也被判合规，说明下面那条断言是空转"
    ).toBe(false);
  });

  it("两种语言的 FAQ 答案都补上了崩溃诊断这条", async () => {
    for (const locale of ["zh", "en"] as const) {
      const text = await faqAnswer(locale);
      expect(text).toMatch(LOG_CLAIM);
      // 三类被存下来的内容仍然各自点名
      expect(text).toMatch(/Supabase Auth/);
      expect(text).toMatch(/RLS|行级安全/);
      expect(text).toMatch(/评分|rate/i);
    }
  });

  it("隐私页说的是同一件事，而不是另一套口径", async () => {
    for (const locale of ["zh", "en"] as const) {
      const [faq, privacy] = [await faqAnswer(locale), await privacyText(locale)];
      expect(faq).toMatch(LOG_CLAIM);
      expect(privacy).toMatch(LOG_CLAIM);
    }
  });
});
