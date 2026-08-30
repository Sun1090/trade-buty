import Link from "next/link";

type SidebarItem = { href: string; label: string; icon: string };

export function LearningSidebar({ locale, labels }: { locale: string; labels: { learn: string; practice: string; review: string; stats: string; bookmarks: string; search: string; ai: string } }) {
  const prefix = `/${locale}`;
  const groups: { title: string; items: SidebarItem[] }[] = [
    { title: locale === "zh" ? "学习" : "Learn", items: [{ href: "/", label: locale === "zh" ? "学习首页" : "Dashboard", icon: "⌂" }, { href: "/path", label: labels.learn, icon: "◈" }] },
    { title: locale === "zh" ? "练习" : "Practice", items: [{ href: "/chart", label: locale === "zh" ? "行情练习" : "Charts", icon: "⌁" }, { href: "/replay", label: labels.practice, icon: "◷" }, { href: "/review", label: labels.review, icon: "↻" }] },
    { title: locale === "zh" ? "我的学习" : "My learning", items: [{ href: "/stats", label: labels.stats, icon: "▥" }, { href: "/bookmarks", label: labels.bookmarks, icon: "☆" }, { href: "/search", label: labels.search, icon: "⌕" }, { href: "/ai", label: labels.ai, icon: "✦" }] },
  ];
  return <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-[var(--border)] bg-[var(--background)]/95 px-4 pb-6 pt-24 backdrop-blur-xl lg:block">
    <nav className="space-y-7" aria-label={locale === "zh" ? "主导航" : "Main navigation"}>
      {groups.map((group) => <div key={group.title}><p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-faint">{group.title}</p><div className="space-y-1">{group.items.map((item) => <Link key={item.href} href={`${prefix}${item.href}`} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition hover:bg-[var(--surface-hover)] hover:text-foreground"><span className="flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-base text-accent/80 transition group-hover:border-accent/30 group-hover:bg-accent/10">{item.icon}</span><span>{item.label}</span></Link>)}</div></div>)}
    </nav>
    <div className="absolute bottom-6 left-4 right-4 rounded-2xl border border-accent/20 bg-accent/5 p-4"><p className="text-xs font-semibold text-accent">{locale === "zh" ? "学习原则" : "Learning principle"}</p><p className="mt-2 text-xs leading-relaxed text-muted">{locale === "zh" ? "先理解风险，再练习决策。" : "Understand risk before practising decisions."}</p></div>
  </aside>;
}
