"use client";

import dynamic from "next/dynamic";

/**
 * R9.8：return-nudge toast 的客户端懒加载包装（Next 16 要求 ssr:false 必须在 client 组件里）。
 * 仅在 auth-provider 检测到需要提示时动态 import——绝大多数会话都不会进入这个 chunk。
 */
export const ReturnNudgeToastLazy = dynamic(
  () => import("@/components/return-nudge-toast").then((m) => m.ReturnNudgeToast),
  { ssr: false },
);
