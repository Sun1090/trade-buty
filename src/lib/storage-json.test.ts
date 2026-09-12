import { describe, expect, it } from "vitest";
import {
  isRecord,
  readNonNegativeInteger,
  readNonNegativeNumber,
  readStorageJson,
} from "./storage-json";

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  } satisfies Storage;
}

describe("isRecord", () => {
  it("只把普通对象当成记录", () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord("{}")).toBe(false);
    expect(isRecord(0)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
  });
});

describe("readStorageJson", () => {
  it("解析已存在的 JSON 值", () => {
    const storage = memoryStorage({ "tb-x": JSON.stringify({ n: 3 }) });
    expect(readStorageJson("tb-x", storage)).toEqual({ n: 3 });
  });

  it("键不存在时返回 null（区分「没有」与「值为 null」之前的原始读取）", () => {
    expect(readStorageJson("missing", memoryStorage())).toBeNull();
  });

  it("JSON 损坏时返回 null 而不是抛错", () => {
    const storage = memoryStorage({ "tb-x": "{ not json" });
    expect(readStorageJson("tb-x", storage)).toBeNull();
  });

  it("storage.getItem 抛错（隐私模式）时返回 null", () => {
    const storage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
    } as unknown as Storage;
    expect(readStorageJson("tb-x", storage)).toBeNull();
  });

  it("SSR：没有 storage 且没有全局 localStorage 时返回 null", () => {
    expect(readStorageJson("tb-x", undefined as unknown as Storage)).toBeNull();
  });
});

describe("readNonNegativeNumber", () => {
  it("保留有限非负数", () => {
    expect(readNonNegativeNumber(0)).toBe(0);
    expect(readNonNegativeNumber(3.5)).toBe(3.5);
    expect(readNonNegativeNumber(120)).toBe(120);
  });

  it("负数 / NaN / Infinity / 非数字回退到 fallback", () => {
    expect(readNonNegativeNumber(-1)).toBe(0);
    expect(readNonNegativeNumber(-0.0001, 7)).toBe(7);
    expect(readNonNegativeNumber(Number.NaN, 7)).toBe(7);
    expect(readNonNegativeNumber(Number.POSITIVE_INFINITY, 7)).toBe(7);
    expect(readNonNegativeNumber("3", 7)).toBe(7);
    expect(readNonNegativeNumber(null, 7)).toBe(7);
    expect(readNonNegativeNumber(undefined, 7)).toBe(7);
  });
});

describe("readNonNegativeInteger", () => {
  it("四舍五入到整数", () => {
    expect(readNonNegativeInteger(3.4)).toBe(3);
    expect(readNonNegativeInteger(3.5)).toBe(4);
    expect(readNonNegativeInteger(2)).toBe(2);
  });

  it("非法值回退到 fallback", () => {
    expect(readNonNegativeInteger(-1)).toBe(0);
    expect(readNonNegativeInteger(Number.NaN, 9)).toBe(9);
    expect(readNonNegativeInteger(Number.POSITIVE_INFINITY, 9)).toBe(9);
  });
});
