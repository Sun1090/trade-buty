"use client";

import { useEffect, useState } from "react";
import type { TocItem } from "@/lib/toc";

export function Toc({ items, heading }: { items: TocItem[]; heading: string }) {
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    if (items.length === 0) return;
    const headings = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => !!el);
    if (headings.length === 0) return;

    const ob = new IntersectionObserver(
      (entries) => {
        // 取视口最上方的可见标题
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px" }
    );
    headings.forEach((h) => ob.observe(h));
    return () => ob.disconnect();
  }, [items]);

  if (items.length < 3) return null;

  return (
    <nav
      aria-label={heading}
      className="hidden 2xl:block fixed right-6 top-24 w-52 max-h-[calc(100vh-8rem)] overflow-y-auto"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-faint mb-3">
        {heading}
      </p>
      <ul className="space-y-1.5 border-l border-[var(--border)]">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(item.id)?.scrollIntoView({
                  behavior: "smooth",
                });
                setActive(item.id);
              }}
              className={`block text-xs leading-snug transition-all duration-300 border-l-2 -ml-px ${
                item.depth === 3 ? "pl-5" : "pl-3"
              } ${
                active === item.id
                  ? "text-accent font-medium border-accent bg-[var(--accent-dim)] rounded-r"
                  : "text-muted hover:text-foreground border-transparent"
              }`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
