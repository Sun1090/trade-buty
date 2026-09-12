/**
 * R7.12：有容量上限的 Map。
 *
 * 路由里的进程内缓存/限流表（IP 计数、相同问题缓存）如果用裸 Map，
 * 在长生命周期实例上会无限增长：伪造 X-Forwarded-For 的攻击者可以
 * 每个请求塞一个 key，最终把实例内存吃满。这里给出带 FIFO 淘汰的
 * 封装：写入前先删后插（刷新顺序），超过上限时从最旧的开始淘汰。
 *
 * 与 LRU 的差别：读取**不**改变顺序（不需要维护双向链表），
 * 对这些「短 TTL、命中即过期」的场景足够，且读写都是 O(1)。
 */
export class BoundedMap<K, V> {
  private readonly map = new Map<K, V>();

  constructor(private readonly maxSize: number) {
    if (!Number.isFinite(maxSize) || maxSize < 1) {
      throw new RangeError("BoundedMap maxSize must be >= 1");
    }
  }

  get size(): number {
    return this.map.size;
  }

  get(key: K): V | undefined {
    return this.map.get(key);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  /** 写入并刷新该 key 的新鲜度；超出上限时淘汰最旧的条目。 */
  set(key: K, value: V): this {
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next();
      if (oldest.done) break;
      this.map.delete(oldest.value);
    }
    return this;
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  keys(): IterableIterator<K> {
    return this.map.keys();
  }

  entries(): IterableIterator<[K, V]> {
    return this.map.entries();
  }

  values(): IterableIterator<V> {
    return this.map.values();
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.map.entries();
  }
}

/**
 * 惰性清理已过期条目：仅在表内条目数超过 `threshold` 时全量扫一遍，
 * 避免每个请求都做 O(n) 扫描。返回被清掉的条数。
 */
export function sweepExpired<K, V>(
  map: BoundedMap<K, V>,
  isExpired: (value: V) => boolean,
  threshold: number,
): number {
  if (map.size < threshold) return 0;
  let removed = 0;
  for (const [key, value] of map) {
    if (isExpired(value)) {
      map.delete(key);
      removed++;
    }
  }
  return removed;
}
