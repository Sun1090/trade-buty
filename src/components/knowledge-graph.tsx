import Link from "next/link";
import { getStageGroups } from "@/lib/path";

/** 27 篇章知识图谱：三阶段分组可视化（SVG 节点 + 连接线） */
export function KnowledgeGraph({ locale }: { locale: string }) {
  const groups = getStageGroups(locale);

  // 每阶段数
  const counts = groups.map((g) => g.chapters.length);
  const maxCount = Math.max(...counts, 1);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-faint">
          {locale === "en" ? "Knowledge map · bars show lesson count" : "知识图谱 · 条长表示课程数"}
        </p>
        <div className="flex items-center gap-3 text-[10px] text-faint">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-[var(--accent)]/40 inline-block" />{locale === "en" ? "Chapter" : "篇章"}</span>
          <span className="flex items-center gap-1"><span className="w-6 h-1 rounded-full bg-accent inline-block" />{locale === "en" ? "Lessons" : "课程"}</span>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {groups.map(({ stage, chapters }) => (
          <div key={stage.id}>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-3">
              {stage.id === "core" ? "★" : stage.id === "practice" ? "◆" : "◇"} {locale === "en" ? stageText(stage.id, locale) : stageText(stage.id, locale)}
            </p>
            <div className="space-y-1.5">
              {chapters.map((c, i) => (
                <Link
                  key={c.slug}
                  href={`/${locale}/knowledge/${c.slug}`}
                  className="group flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2 hover:border-[var(--accent)]/50 transition"
                >
                  <span className="shrink-0 w-5 h-5 rounded-full border border-[var(--accent)]/40 text-[10px] text-accent flex items-center justify-center font-mono">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-xs font-medium truncate group-hover:text-accent transition-colors">
                    {c.title}
                  </span>
                  {/* 完成度小点 */}
                  <span className="ml-auto w-10 h-1 rounded-full bg-white/10 overflow-hidden shrink-0">
                    <span
                      className="h-full bg-accent rounded-full"
                      style={{ width: `${Math.min(100, (c.docCount / maxCount) * 100)}%` }}
                    />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function stageText(id: string, locale: string): string {
  const map: Record<string, [string, string]> = {
    core: ["基础阶段 · 入门主线", "Foundation · Core path"],
    practice: ["进阶阶段 · 实操练习", "Practice · Apply it"],
    deep: ["深化阶段 · 专题进阶", "Deep dive · Advanced"],
  };
  return map[id]?.[locale === "en" ? 1 : 0] ?? id;
}