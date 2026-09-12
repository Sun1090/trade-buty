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
  /** 未登录用户每小时配额 */
  guestLimit: number;
  /** 已登录用户每小时配额 */
  authedLimit: number;
  /** 配额窗口（ms），默认 1 小时 */
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

const HOUR_MS = 3_600_000;

/** 从请求头取客户端 IP（取 X-Forwarded-For 第一段） */
export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export interface RateLimiter {
  check(key: string, isAuthed: boolean, now?: number): RateLimitDecision;
}

/** 创建一个独立配额窗口的限流器（每个路由各持一个） */
export function createRateLimiter(opts: RateLimitOptions): RateLimiter {
  const windowMs = opts.windowMs ?? HOUR_MS;
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
