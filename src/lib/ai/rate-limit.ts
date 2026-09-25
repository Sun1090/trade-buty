/**
 * R7.12：AI 生成类路由的共享内存限流器。
 *
 * 背景：`/api/ai/chat` 早已有限流，但同样会调用 LLM/Embedding 的
 * `/api/ai/plan`、`/api/ai/summary`、`/api/ai/quiz` 完全没有配额，
 * 攻击者可以无限打这三个端点烧掉上游 API 预算。
 *
 * 设计取舍：
 * - 进程内内存态（Node.js 实例间相互独立）：只用于防基础滥用，不追求分布式精确配额。
 * - 底层用 `BoundedMap`：否则伪造 `X-Forwarded-For` 的请求可以每个请求塞一个新 key，
 *   把常驻实例的内存吃满。
 * - 过期窗口按需清扫（阈值触发），不做每请求全量扫描。
 */
import type { NextRequest } from "next/server";
import { BoundedMap, sweepExpired } from "@/lib/bounded-map";

export interface RateLimitOptions {
  /** 未登录用户在一个配额窗口内的次数（窗口长度见 `windowMs`） */
  guestLimit: number;
  /** 已登录用户在一个配额窗口内的次数 */
  authedLimit: number;
  /**
   * 配额窗口（ms），默认 `DEFAULT_WINDOW_MS`（1 小时）。
   *
   * 窗口是**从这个人这一串请求里的第一次**算起、往后推 `windowMs`（见 `check()` 里
   * `reset: now + windowMs` 那一行），不是墙上钟点的那一格。10:50 问的第一次，窗口到
   * 11:50 结束——所以界面文案不许说「本小时 / this hour」，那是把一次滚动计数说成按
   * 整点刷新。由 `src/lib/quota-window-claims.test.ts` 守着这条口径。
   */
  windowMs?: number;
  /** 内存里最多保留多少个 key，默认 10_000 */
  maxKeys?: number;
  /** 表大小超过该阈值才触发一次过期清扫，默认 5_000 */
  sweepThreshold?: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** 仅在 allowed=false 时 > 0 */
  retryAfterSec: number;
}

/** 默认配额窗口长度（ms）。界面里那些「一小时」的说法以它为准。 */
export const DEFAULT_WINDOW_MS = 3_600_000;

/** 从请求头取客户端 IP（取 X-Forwarded-For 第一段） */
export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export interface RateLimiter {
  check(key: string, isAuthed: boolean, now?: number): RateLimitDecision;
}

/** 创建一个独立配额窗口的限流器（每个路由各持一个） */
export function createRateLimiter(opts: RateLimitOptions): RateLimiter {
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const maxKeys = opts.maxKeys ?? 10_000;
  const sweepThreshold = opts.sweepThreshold ?? 5_000;
  const hits = new BoundedMap<string, { count: number; reset: number }>(maxKeys);

  return {
    check(key: string, isAuthed: boolean, now: number = Date.now()): RateLimitDecision {
      const limit = isAuthed ? opts.authedLimit : opts.guestLimit;
      sweepExpired(hits, (v) => v.reset <= now, sweepThreshold);
      const hit = hits.get(key);
      if (hit && now < hit.reset) {
        if (hit.count >= limit) {
          return {
            allowed: false,
            limit,
            remaining: 0,
            retryAfterSec: Math.ceil((hit.reset - now) / 1000),
          };
        }
        hit.count += 1;
        hits.set(key, hit);
        return { allowed: true, limit, remaining: limit - hit.count, retryAfterSec: 0 };
      }
      hits.set(key, { count: 1, reset: now + windowMs });
      return { allowed: true, limit, remaining: limit - 1, retryAfterSec: 0 };
    },
  };
}
