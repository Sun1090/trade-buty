"use client";

import { useState } from "react";
import Link from "next/link";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

/** 移动端导航：窄屏汉堡按钮 + 抽屉菜单 */
export function MobileNav({ items, locale }: { items: NavItem[]; locale: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        aria-expanded={open}
        className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          {open ? (
            <path d="M6 6l12 12M6 18L18 6" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>
      {open && (
        <div className="absolute top-14 left-0 right-0 border-b border-[var(--border)] bg-[var(--background)] shadow-lg z-50">
          <nav className="flex flex-col p-4 gap-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={`/${locale}${item.href}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition"
              >
                <span aria-hidden>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
