"use client";

import { useState } from "react";

/** 折叠展开组件：默认收起，点击展开 */
export function Collapsible({
  preview,
  children,
  expandLabel,
  collapseLabel,
}: {
  preview: React.ReactNode;
  children: React.ReactNode;
  expandLabel: string;
  collapseLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <div
        className={
          open
            ? ""
            : "max-h-28 overflow-hidden [mask-image:linear-gradient(to_bottom,black_50%,transparent)]"
        }
      >
        {preview}
        {open && <div className="mt-3">{children}</div>}
      </div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-3 text-sm text-accent hover:text-foreground transition font-medium inline-flex items-center gap-1"
      >
        {open ? collapseLabel : expandLabel}
        <span className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden>▾</span>
      </button>
    </div>
  );
}