import Link from "next/link";
import { getStageGroups } from "@/lib/path";
import { getDict } from "@/lib/i18n";

/**
 * 知识库篇章图谱：按阶段分组可视化（节点 + 课数条），篇章与阶段数都由传入数据决定。
 * 阶段名直接取本页上方各节用的那份字典：组件里另抄一套时，同一页会拿两个名字指同一个阶段
 * （这里曾是「基础阶段 · 入门主线」，页面上方是「第一站 · 入门主线」）。
 */
export function KnowledgeGraph({ locale }: { locale: string }) {
  const groups = getStageGroups(locale);
  const stages = getDict(locale).path.stages;

  // 条长的分母：图上所有篇章里最多的那个课数。
  // 早期这里除的是「每个阶段有几篇」（9/8/10 → 10），于是 16 课的、13 课的、11 课的全都
  // 顶格 100%，条长实际量的是「课数 ÷ 某阶段篇章数」，跟图例写的「条长表示课程数」不是一回事。
  const maxDocCount = Math.max(
    ...groups.flatMap((g) => g.chapters.map((c) => c.docCount)),
    1
  );

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-faint">
          {locale === "en" ? "Bar length = lesson count" : "条长表示课程数"}
        </p>
        <div className="flex items-center gap-3 text-[10px] text-faint">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-[var(--accent)]/40 inline-block" />{locale === "en" ? "Chapter" : "篇章"}</span>
          <span className="flex items-center gap-1"><span className="w-6 h-1 rounded-full bg-accent inline-block" />{locale === "en" ? "Lessons" : "课程"}</span>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {groups.map(({ stage, chapters }) => (
          <div key={stage.id} className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-3">
              <span aria-hidden>{stage.id === "core" ? "★" : stage.id === "practice" ? "◆" : "◇"}</span>{" "}
              {stages[stage.id].label} · {stages[stage.id].title}
            </p>
            <div className="space-y-1.5">
              {chapters.map((c) => (
                <Link
                  key={c.slug}
                  href={`/${locale}/knowledge/${c.slug}`}
                  className="group min-w-0 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2 hover:border-[var(--accent)]/50 transition"
                >
                  {/* 节点画成图例里那颗圆点，不写数字：标题自带的 `NN ·` 才是篇章编号 */}
                  <span className="shrink-0 w-2 h-2 rounded-full border border-[var(--accent)]/40" />
                  <span className="min-w-0 text-xs font-medium truncate group-hover:text-accent transition-colors">
                    {c.title}
                  </span>
                  {/* 课数条：长度是「本章课数 ÷ 全书最大课数」，与读没读无关 */}
                  <span className="ml-auto w-10 h-1 rounded-full bg-white/10 overflow-hidden shrink-0">
                    <span
                      className="h-full bg-accent rounded-full"
                      style={{ width: `${Math.min(100, (c.docCount / maxDocCount) * 100)}%` }}
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