"use client";

import dynamic from "next/dynamic";

/**
 * R9.7：合并摘要 toast 的客户端懒加载包装（Next 16 要求 ssr:false 必须放在 client 组件里）。
 * 服务端 layout 引入本组件，本组件再按需 dynamic import 真正的 toast 实现。
 */
export const SyncSummaryToastLazy = dynamic(
  () => import("@/components/sync-summary-toast").then((m) => m.SyncSummaryToast),
  { ssr: false },
);
