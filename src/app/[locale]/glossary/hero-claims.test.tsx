// @vitest-environment jsdom
/**
 * 术语表 hero 那句是页面自己写下的承诺（英文原先写 "with bilingual definitions"），
 * 而卡片每语只渲染**一条**释义，中英并列的其实是词条名。字典门禁只看字符串，
 * 看不到这一页到底给了什么，所以这条要真实渲染才算数。
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { GLOSSARY_TERMS } from "@/lib/glossary";
import GlossaryPage from "./page";

function props(locale: "zh" | "en"): PageProps<"/[locale]/glossary"> {
  return { params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) };
}

const FIRST = GLOSSARY_TERMS[0];

async function renderGlossary(locale: "zh" | "en"): Promise<string> {
  document.body.innerHTML = "";
  render((await GlossaryPage(props(locale))) as ReactElement);
  await screen.findByText(locale === "en" ? "Trading Glossary" : "交易术语表");
  return document.body.textContent ?? "";
}

describe("术语表 hero 的说法与实际给的东西（R16.88）", () => {
  it("英文页给两条名字、一条英文释义——中文释义不在页面上", async () => {
    const body = await renderGlossary("en");
    expect(body).toContain(FIRST.en);
    expect(body).toContain(FIRST.term);
    expect(body).toContain(FIRST.defEn.slice(0, 24));
    expect(body).not.toContain(FIRST.def.slice(0, 12));
  });

  it("中文页对称：给中文释义，不给英文释义", async () => {
    const body = await renderGlossary("zh");
    expect(body).toContain(FIRST.term);
    expect(body).toContain(FIRST.en);
    expect(body).toContain(FIRST.def.slice(0, 12));
    expect(body).not.toContain(FIRST.defEn.slice(0, 24));
  });
});
