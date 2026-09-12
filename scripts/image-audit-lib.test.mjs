import { describe, expect, it } from "vitest";
import { findAssetProblems } from "./image-audit-lib.mjs";

describe("findAssetProblems", () => {
  it("accepts referenced and mirrored assets", () => {
    expect(
      findAssetProblems({
        byLocale: {
          zh: { basics: ["diagram.png"] },
          en: { basics: ["diagram.png"] },
        },
        referenced: {
          zh: { basics: ["diagram.png"] },
          en: { basics: ["diagram.png"] },
        },
      })
    ).toEqual([]);
  });

  it("reports an unreferenced asset in both locales as two orphans", () => {
    const problems = findAssetProblems({
      byLocale: {
        zh: { basics: ["orphan.png"] },
        en: { basics: ["orphan.png"] },
      },
      referenced: { zh: { basics: [] }, en: { basics: [] } },
    });

    expect(problems).toEqual([
      "zh/basics/_assets/orphan.png：资产未被任何课程引用（孤儿）",
      "en/basics/_assets/orphan.png：资产未被任何课程引用（孤儿）",
    ]);
  });

  it("reports one-sided mirror drift even when the asset is referenced", () => {
    const problems = findAssetProblems({
      byLocale: {
        zh: { basics: ["diagram.png"] },
        en: { basics: [] },
      },
      referenced: {
        zh: { basics: ["diagram.png"] },
        en: { basics: [] },
      },
    });

    expect(problems).toEqual([
      "zh/basics/_assets/diagram.png：资产未在另一 locale 镜像（zh/en 需同步增删）",
    ]);
  });
});
