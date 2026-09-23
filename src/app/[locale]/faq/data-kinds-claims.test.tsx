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

/**
 * R16.53：「AI 那两类点击是匿名行」只在**未登录**时成立。
 * `src/app/api/ai/feedback/route.ts` 与 `src/app/api/ai/citation-click/route.ts` 写的都是
 * `user_id: user?.id ?? null`——登录了就带上账户 id。隐私页和 FAQ 原先无条件宣称「不带账户 /
 * carry no account」，而同一份隐私页下面又写着评分随账户删除、引用点击在注销时摘掉身份，
 * 两句话互相拆台。这里要求：任何「不带账户」式说法都必须就地带着「未登录」的限定，
 * 并且两页都得正面说出登录后的情形。
 */
const ANON_CLAIM_RE = /不带账户|不含账户|不关联账户|carry no account|hold no account/gi;
/** 限定语可以在前后 60 字内出现：中文写「未登录时……不带账户」，英文写「…no account while you are logged out」 */
const GUEST_QUALIFIER_RE = /未登录|logged out|before you log in/i;
/** 正面说出登录后的情形：中英两版措辞顺序不同，所以只要求两半都在同一句答案里出现 */
const LOGGED_IN_RE = /登录后|logged in/i;
const ACCOUNT_ID_RE = /账户标识|account identifier/i;
const CLAIM_WINDOW = 60;

/** 找出没有「未登录」限定的匿名断言（旧写法正是这样一句） */
function unconditionalAnonClaims(text: string): string[] {
  const bad: string[] = [];
  for (const match of text.matchAll(ANON_CLAIM_RE)) {
    const at = match.index ?? 0;
    const around = text.slice(Math.max(0, at - CLAIM_WINDOW), at + CLAIM_WINDOW);
    if (!GUEST_QUALIFIER_RE.test(around)) bad.push(match[0]);
  }
  return bad;
}

const LEGACY_PRIVACY_ZH =
  "只有两种点击会以匿名方式落库——给某条回答点「有用/没用」时，这次评分连同你的问题和该条回答全文一起写入；点开回答里的某条引用时，写入的是该引用指向的篇章/小节以及你的问题。这些行不带账户、不带邮箱、不带设备标识，只用于人工复核答案质量。";
const LEGACY_PRIVACY_EN =
  "Two clicks are stored anonymously, though - rating one of the answers helpful or unhelpful saves that rating together with your question and the full answer text. These rows carry no account, no email address and no device identifier; they exist so a human can review answer quality.";

describe("两页不得无条件宣称 AI 那两类记录匿名", () => {
  it("禁令抓得住旧写法（自证不是空转）", () => {
    expect(unconditionalAnonClaims(LEGACY_PRIVACY_ZH)).toEqual(["不带账户"]);
    expect(unconditionalAnonClaims(LEGACY_PRIVACY_EN)).toEqual(["carry no account"]);
    expect(unconditionalAnonClaims(LEGACY_FAQ_ANSWER)).toEqual(["不关联账户"]);
  });

  it("隐私页与 FAQ 都不再无条件说「不带账户」", async () => {
    for (const locale of ["zh", "en"] as const) {
      expect(unconditionalAnonClaims(await faqAnswer(locale)), `${locale} FAQ`).toEqual([]);
      expect(unconditionalAnonClaims(await privacyText(locale)), `${locale} 隐私页`).toEqual([]);
    }
  });

  it("两页都正面说出「登录后会带上账户标识」", async () => {
    for (const locale of ["zh", "en"] as const) {
      for (const [name, text] of [
        ["FAQ", await faqAnswer(locale)],
        ["隐私页", await privacyText(locale)],
      ] as const) {
        expect(text, `${locale} ${name} 没提登录后这半`).toMatch(LOGGED_IN_RE);
        expect(text, `${locale} ${name} 没说清带上的是什么`).toMatch(ACCOUNT_ID_RE);
      }
    }
  });
});
