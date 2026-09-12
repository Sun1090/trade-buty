import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditGrowthSurfaces,
  findUnregisteredGrowthComponents,
  loadInventory,
  scanCopy,
  scanComponent,
  extractLocaleBlock,
  extractSection,
  extractEntries,
  BANNED_ZH,
  BANNED_EN,
  DISMISS_SHAMING,
} from "./check-dark-pattern-copy.mjs";

const cleanI18n = `
const zh = {
  auth: {
    returnNudgeTitleTpl: "已 {days} 天没来 Trade Buty",
    returnNudgeBodyTpl: "继续学习路线，或做一节回放训练找回手感。",
    returnNudgeLater: "稍后再说",
  },
  newsletter: {
    title: "邮件订阅（占位）",
    submit: "保存邮箱（本地）",
  },
  share: {
    ctaTitle: "也想系统学交易？",
    ctaPath: "开始学习路线 →",
  },
  install: {
    title: "安装 Trade Buty",
    body: "浏览器允许时可添加到设备，不会自动安装。",
    dismiss: "暂不",
  },
  invite: {
    titleTpl: "来自朋友邀请 · ref {ref}",
    bodyTpl: "你通过邀请链接进入 Trade Buty。",
    dismiss: "知道了",
  },
};
const en: Dict = {
  auth: {
    returnNudgeTitleTpl: "It's been {days} days since your last visit",
    returnNudgeBodyTpl: "Pick up where you left off, or run a quick replay drill.",
    returnNudgeLater: "Maybe later",
  },
  newsletter: {
    title: "Newsletter (placeholder)",
    submit: "Save email (local)",
  },
  share: {
    ctaTitle: "Want to learn trading too?",
    ctaPath: "Start learning path →",
  },
  install: {
    title: "Install Trade Buty",
    body: "Add it to this device when your browser allows it.",
    dismiss: "Not now",
  },
  invite: {
    titleTpl: "Invited by a friend · ref {ref}",
    bodyTpl: "You arrived via a referral link.",
    dismiss: "Got it",
  },
};`;

function cleanInventory() {
  return {
    surfaces: [
      {
        id: "install-prompt",
        component: "src/components/install.tsx",
        i18nSection: "install",
        dismissKeys: ["dismiss"],
        blocking: false,
        requiresDismiss: true,
        optIn: true,
      },
      {
        id: "invite-banner",
        component: "src/components/invite.tsx",
        i18nSection: "invite",
        dismissKeys: ["dismiss"],
        blocking: false,
        requiresDismiss: true,
        optIn: false,
      },
      {
        id: "return-nudge",
        component: "src/components/nudge.tsx",
        i18nSection: "auth",
        keyPrefix: "returnNudge",
        dismissKeys: ["returnNudgeLater"],
        blocking: false,
        requiresDismiss: true,
        optIn: false,
      },
      {
        id: "newsletter-signup",
        component: "src/components/newsletter.tsx",
        i18nSection: "newsletter",
        dismissKeys: [],
        blocking: false,
        requiresDismiss: false,
        optIn: true,
      },
      {
        id: "share-cards",
        component: "src/components/share.tsx",
        i18nSection: "share",
        dismissKeys: [],
        blocking: false,
        requiresDismiss: false,
        optIn: true,
      },
    ],
  };
}

const CLEAN_INSTALL = `export function Install(){return <aside><button onClick={handleDismiss}>x</button><button>go</button></aside>}`;
const CLEAN_INVITE = `export function Invite(){return <div role="status"><button onClick={handleDismiss}>x</button></div>}`;
const CLEAN_NUDGE = `export function Nudge(){return <div role="status"><button onClick={()=>setOpen(false)}>x</button></div>}`;
const CLEAN_NEWSLETTER = `export function News(){return <form onSubmit={handleSave}><button type="submit">save</button></form>}`;
const CLEAN_SHARE = `export function Share(){return <a href="/path">go</a>}`;

let dir;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "dark-pattern-"));
  mkdirSync(join(dir, "src/components"), { recursive: true });
  writeFileSync(join(dir, "src/components/install.tsx"), CLEAN_INSTALL);
  writeFileSync(join(dir, "src/components/invite.tsx"), CLEAN_INVITE);
  writeFileSync(join(dir, "src/components/nudge.tsx"), CLEAN_NUDGE);
  writeFileSync(join(dir, "src/components/newsletter.tsx"), CLEAN_NEWSLETTER);
  writeFileSync(join(dir, "src/components/share.tsx"), CLEAN_SHARE);
});

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("check-dark-pattern-copy", () => {
  it("passes a clean fixture", () => {
    const { errors, info } = auditGrowthSurfaces({
      rootDir: dir,
      inventory: cleanInventory(),
      i18nSource: cleanI18n,
    });
    expect(errors).toEqual([]);
    expect(info).toHaveLength(5);
  });

  it("extracts locale blocks and sections without tripping on nested braces or templates", () => {
    const zh = extractLocaleBlock(cleanI18n, "zh");
    expect(zh).toBeTruthy();
    const share = extractSection(zh, "share");
    expect(share).toContain("也想系统学交易");
    const entries = extractEntries(extractSection(zh, "auth"));
    expect(Object.keys(entries)).toContain("returnNudgeLater");
  });

  it("flags zh fake urgency and false scarcity copy", () => {
    const hits = scanCopy(["限时免费，最后机会！", "仅剩 3 个名额"], BANNED_ZH);
    expect(hits.map((h) => h.rule)).toEqual(
      expect.arrayContaining(["虚假紧迫", "虚假稀缺"]),
    );
  });

  it("flags en urgency and fake social proof copy", () => {
    const hits = scanCopy(
      ["Limited time — act now!", "Join 12,000 learners already"],
      BANNED_EN,
    );
    expect(hits.map((h) => h.rule)).toEqual(
      expect.arrayContaining(["fake urgency", "fake social proof"]),
    );
  });

  it("flags confirm-shaming dismiss labels", () => {
    expect(scanCopy(["不感兴趣，我放弃"], [["guilt-dismiss", DISMISS_SHAMING[0]]])).toHaveLength(1);
    expect(scanCopy(["No thanks, I don't want to learn"], [["guilt-dismiss", DISMISS_SHAMING[1]]])).toHaveLength(1);
  });

  it("fails when a growth surface drifts into urgency copy", () => {
    const dirty = cleanI18n.replace(
      "也想系统学交易？",
      "限时免费，错过就没有了，马上抢！",
    );
    const { errors } = auditGrowthSurfaces({
      rootDir: dir,
      inventory: cleanInventory(),
      i18nSource: dirty,
    });
    expect(errors.some((e) => e.rule === "zh/虚假紧迫")).toBe(true);
  });

  it("fails when a required dismiss key is missing in one language", () => {
    const dirty = cleanI18n.replace('    dismiss: "Not now",\n', "");
    const { errors } = auditGrowthSurfaces({
      rootDir: dir,
      inventory: cleanInventory(),
      i18nSource: dirty,
    });
    expect(errors.some((e) => e.rule === "dismiss-copy")).toBe(true);
  });

  it("fails when a non-blocking surface renders a blocking dialog", () => {
    writeFileSync(
      join(dir, "src/components/invite.tsx"),
      `export function Invite(){return <div role="dialog" aria-modal="true"><button onClick={handleDismiss}>x</button></div>}`,
    );
    const { errors } = auditGrowthSurfaces({
      rootDir: dir,
      inventory: cleanInventory(),
      i18nSource: cleanI18n,
    });
    expect(errors.some((e) => e.rule === "blocking-dialog")).toBe(true);
    writeFileSync(join(dir, "src/components/invite.tsx"), CLEAN_INVITE);
  });

  it("detects countdown, forced focus, default opt-in and missing dismiss in components", () => {
    const hits = scanComponent(
      `setInterval(()=>{},1000); <input autoFocus defaultChecked />`,
      { blocking: false, requiresDismiss: true },
    );
    const rules = hits.map((h) => h.rule);
    expect(rules).toEqual(
      expect.arrayContaining(["countdown", "forced-focus", "default-opt-in", "missing-dismiss"]),
    );
  });

  it("rejects an inventory without a surfaces array", () => {
    const { errors } = auditGrowthSurfaces({
      rootDir: dir,
      inventory: {},
      i18nSource: cleanI18n,
    });
    expect(errors[0].rule).toBe("inventory");
  });

  it("fails when a new growth-looking component is not registered", () => {
    writeFileSync(join(dir, "src/components/new-banner.tsx"), `export function B(){return null}`);
    const { errors } = auditGrowthSurfaces({
      rootDir: dir,
      inventory: cleanInventory(),
      i18nSource: cleanI18n,
    });
    expect(errors.some((e) => e.rule === "unregistered")).toBe(true);
    rmSync(join(dir, "src/components/new-banner.tsx"));
  });

  it("allows a growth-looking component when an exemption reason is recorded", () => {
    const inventory = cleanInventory();
    const component = "src/components/new-banner.tsx";
    writeFileSync(join(dir, component), `export function B(){return null}`);
    inventory.unregisteredAllowed = [{ component, reason: "被 share-cards 表面覆盖" }];
    const { errors } = auditGrowthSurfaces({ rootDir: dir, inventory, i18nSource: cleanI18n });
    expect(errors.filter((e) => e.rule === "unregistered")).toEqual([]);
    rmSync(join(dir, component));
  });

  it("detects an unregistered component via the coverage helper", () => {
    writeFileSync(join(dir, "src/components/extra-prompt.tsx"), `export function P(){return null}`);
    const missing = findUnregisteredGrowthComponents({ rootDir: dir, inventory: cleanInventory() });
    expect(missing).toContain("src/components/extra-prompt.tsx");
    rmSync(join(dir, "src/components/extra-prompt.tsx"));
  });

  it("passes on the real repository inventory", () => {
    const realRoot = join(fileURLToPath(import.meta.url), "..", "..");
    const inventory = loadInventory(realRoot);
    const i18nSource = readFileSync(join(realRoot, "src/lib/i18n.ts"), "utf8");
    const { errors } = auditGrowthSurfaces({ rootDir: realRoot, inventory, i18nSource });
    expect(errors).toEqual([]);
  });
});
