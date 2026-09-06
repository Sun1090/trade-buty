/** R10.1：内容清单与中英覆盖率的纯计算与 Markdown 渲染。 */

function countDocuments(locale) {
  return Object.values(locale).reduce(
    (sum, documents) => sum + Object.values(documents).flat().length,
    0,
  );
}

function percent(value, total) {
  return total === 0 ? 100 : Math.round((value / total) * 1000) / 10;
}

export function buildContentInventory(zh, en, generatedAt) {
  const zhChapters = Object.keys(zh).sort();
  const enChapters = new Set(Object.keys(en));
  const missingChapters = zhChapters.filter((chapter) => !enChapters.has(chapter));
  const missingDocuments = zhChapters.flatMap((chapter) => {
    const translated = new Set(en[chapter]?.documents?.flat() ?? []);
    const source = zh[chapter]?.documents?.flat() ?? [];
    const documents = source.filter((document) => !translated.has(document)).sort();
    return documents.length > 0 ? [{ chapter, documents }] : [];
  });
  const totalDocuments = countDocuments(zh);
  const translatedDocuments = totalDocuments - missingDocuments.reduce((sum, item) => sum + item.documents.length, 0);

  return {
    generatedAt,
    locales: {
      zh: { chapters: zhChapters.length, documents: totalDocuments },
      en: { chapters: Object.keys(en).length, documents: countDocuments(en) },
    },
    coverage: {
      chapter: {
        translated: zhChapters.length - missingChapters.length,
        total: zhChapters.length,
        percent: percent(zhChapters.length - missingChapters.length, zhChapters.length),
      },
      document: {
        translated: translatedDocuments,
        total: totalDocuments,
        percent: percent(translatedDocuments, totalDocuments),
      },
    },
    missing: { chapters: missingChapters, documents: missingDocuments },
  };
}

export function renderContentInventoryMarkdown(report) {
  const lines = [
    "# 内容清单与中英覆盖率",
    "",
    `> 自动生成于 ${report.generatedAt}（npm run kb:inventory），勿手改。`,
    "",
    `- zh：${report.locales.zh.chapters} 章 / ${report.locales.zh.documents} 篇课程`,
    `- en：${report.locales.en.chapters} 章 / ${report.locales.en.documents} 篇课程`,
    `- 章节覆盖：${report.coverage.chapter.translated}/${report.coverage.chapter.total}（${report.coverage.chapter.percent}%）`,
    `- 课程覆盖：${report.coverage.document.translated}/${report.coverage.document.total}（${report.coverage.document.percent}%）`,
    "",
    "## 待补清单",
    "",
  ];
  if (report.missing.chapters.length === 0 && report.missing.documents.length === 0) {
    lines.push("✅ 当前 zh 内容均有对应英文版本。", "");
  } else {
    for (const chapter of report.missing.chapters) lines.push(`- 缺整章：\`en/${chapter}/\``);
    for (const item of report.missing.documents) {
      lines.push(`- \`${item.chapter}\`：${item.documents.map((doc) => `\`${doc}\``).join("、")}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
