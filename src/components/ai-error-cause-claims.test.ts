/**
 * R16.201：AI 那两句失败提示，一句替用户的网络下了诊断，一句替一件可能是配置
 * 状态的事许了「稍后再试」。
 *
 * 两条分支各自知道什么：
 * - `ai-chat.tsx` 的 `setTimeout(() => controller.abort(), RESPONSE_HEADER_TIMEOUT_MS)`
 *   只管到**响应头到达**（同文件那句注释自己写着「正文流式期不计入」），而
 *   `/api/ai/chat` 是先在上游取回答、再回头送头的（`api/ai/chat/route.ts` 里 `streamChat`
 *   在设头之前）。上游模型慢一秒一秒地磨，屏幕上得到的旧文案是「请求超时，请检查网络后重试」
 *   ——一句话把责任派给了这个人的链路，而代码从没测过它的链路。
 * - `errorServer` 挂在两处：`e instanceof TypeError`（fetch 本身抛错——离线、被拦截，
 *   通常是**这台设备**的问题）与 `res.status >= 500`（本站端点失败——里面还包括缺 Supabase
 *   env 时每次必失败的那条鉴权 catch，那是配置状态，不是「暂时」）。旧文案「服务暂时不可用，
 *   请稍后再试」两头都不对：该说设备的说成服务，该说配置的说成暂时。
 *
 * 新文案不诊断，只说这次发生了什么、以及两种可能的来源——同一个句子在两条分支上共用，
 * 所以它必须对两条都成立（R16.180、R16.200 同族）。数字（30 秒）不许抄：从组件里那个
 * 常量换算，常量一改，文案不同步就红。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getDict } from "@/lib/i18n";
import { RESPONSE_HEADER_TIMEOUT_MS } from "./ai-chat";

const SRC = "src/components/ai-chat.tsx";

/** 只怪用户网络 / 只许暂时 的说法 */
const NETWORK_BLAME = /检查网络|检查你的网络|check your network|check your connection/i;
const TRANSIENT_PROMISE = /暂时|temporarily/i;

describe("AI 失败那两句不说自己没测过的事", () => {
  it("超时那句的秒数就是组件里那个常量换算出来的", () => {
    const seconds = RESPONSE_HEADER_TIMEOUT_MS / 1000;
    expect(RESPONSE_HEADER_TIMEOUT_MS).toBeGreaterThan(0);
    for (const locale of ["zh", "en"] as const) {
      const text = getDict(locale).ai.errorTimeout;
      expect(text, `「errorTimeout」(${locale}) 没写出 ${seconds} 秒这个真实的等待上限`).toContain(String(seconds));
    }
    // 那个常量必须真的用在 abort 上，否则文案对的就不是这一次等待
    const src = readFileSync(path.join(process.cwd(), SRC), "utf8");
    expect(src).toMatch(/setTimeout\(\(\) => controller\.abort\(\), RESPONSE_HEADER_TIMEOUT_MS\)/);
  });

  it("超时那句一边点出两种可能来源，一边不替用户的网络下诊断", () => {
    const zh = getDict("zh").ai.errorTimeout;
    const en = getDict("en").ai.errorTimeout;
    for (const text of [zh, en]) expect(text).not.toMatch(NETWORK_BLAME);
    expect(zh).toMatch(/可能/);
    expect(zh).toMatch(/连接|网络/);
    expect(zh).toMatch(/上游|模型服务商/);
    expect(en.toLowerCase()).toMatch(/may be|could be/);
    expect(en.toLowerCase()).toMatch(/connection/);
    expect(en.toLowerCase()).toMatch(/provider|upstream/);
  });

  it("另一句两头都点名：这台设备的浏览器，与本站的 AI 通路", () => {
    const zh = getDict("zh").ai.errorServer;
    const en = getDict("en").ai.errorServer;
    for (const text of [zh, en]) expect(text, "这条不是临时的也会用它（缺配置的鉴权失败）").not.toMatch(TRANSIENT_PROMISE);
    expect(zh).toMatch(/浏览器/);
    expect(zh).toMatch(/AI 通路|本站/);
    expect(en.toLowerCase()).toMatch(/browser/);
    expect(en.toLowerCase()).toMatch(/this site/);
  });

  it("分支接线不许改：超时归 errorTimeout，fetch 抛错归 errorServer", () => {
    // 上面那句关于「这台设备」的说法只有在这个映射成立时才为真
    const src = readFileSync(path.join(process.cwd(), SRC), "utf8");
    const chain = src.slice(src.indexOf("e instanceof DOMException && e.name === \"AbortError\""));
    expect(chain.slice(0, 260)).toContain("dict.errorTimeout");
    expect(chain.slice(0, 260)).toContain("dict.errorServer");
    expect(chain.slice(0, 260)).toMatch(/e instanceof TypeError/);
  });

  it("正向对照——旧那四句必须被同一组判据报出来", () => {
    const legacy = [
      "请求超时，请检查网络后重试",
      "服务暂时不可用，请稍后再试",
      "Request timed out, please check your network and retry",
      "Service temporarily unavailable, please try again later",
    ];
    const missed = legacy.filter((s) => !NETWORK_BLAME.test(s) && !TRANSIENT_PROMISE.test(s));
    expect(missed, `这些旧写法没被抓到：${missed.join(" / ")}`).toEqual([]);
  });
});
