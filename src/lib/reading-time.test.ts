import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  addReadingTime,
  formatDuration,
  getReadingTime,
  getTotalReadingTime,
  readReadingTime,
} from "./reading-time";
import { addStudyTime } from "./study-time";

vi.mock("./study-time", () => ({ addStudyTime: vi.fn() }));

const studyTime = vi.mocked(addStudyTime);
const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
});

describe("formatDuration", () => {
  it("秒级 < 60s", () => {
    expect(formatDuration(30)).toBe("30s");
    expect(formatDuration(59.4)).toBe("59s");
    expect(formatDuration(59.9)).toBe("1m 0s");
  });

  it("分级 1-59 分", () => {
    expect(formatDuration(60)).toBe("1m 0s");
    expect(formatDuration(90)).toBe("1m 30s");
    expect(formatDuration(3599)).toBe("59m 59s");
    expect(formatDuration(3599.9)).toBe("1h 0m");
  });

  it("小时级 ≥ 60 分", () => {
    expect(formatDuration(3600)).toBe("1h 0m");
    expect(formatDuration(3660)).toBe("1h 1m");
    expect(formatDuration(7384)).toBe("2h 3m");
  });

  it("0 秒", () => {
    expect(formatDuration(0)).toBe("0s");
  });
});

describe("readReadingTime", () => {
  beforeEach(() => store.clear());

  it("拒绝合法 JSON 中的非对象结构", () => {
    store.set("tb-reading-time", "null");
    expect(readReadingTime()).toEqual({});
    expect(getTotalReadingTime()).toBe(0);
    store.set("tb-reading-time", "[]");
    expect(readReadingTime()).toEqual({});
  });

  it("过滤污染字段并保留有效时长", () => {
    store.set(
      "tb-reading-time",
      JSON.stringify({
        "spot/a": 120,
        "spot/b": -1,
        "spot/c": "90",
        "spot/d": Number.NaN,
      }),
    );
    expect(readReadingTime()).toEqual({ "spot/a": 120 });
    expect(getTotalReadingTime()).toBe(120);
  });
});

describe("getReadingTime", () => {
  beforeEach(() => store.clear());

  it("返回已存储的单篇时长", () => {
    store.set("tb-reading-time", JSON.stringify({ "spot/a": 120 }));
    expect(getReadingTime("spot", "a")).toBe(120);
  });

  it("缺失或非法条目的键返回 0", () => {
    store.set("tb-reading-time", JSON.stringify({ "spot/a": "120" }));
    expect(getReadingTime("spot", "a")).toBe(0);
    expect(getReadingTime("spot", "missing")).toBe(0);
  });
});

describe("addReadingTime", () => {
  beforeEach(() => {
    store.clear();
    studyTime.mockReset();
    studyTime.mockImplementation(() => {});
  });

  it("累加本地时长并同步到学习时长台账", async () => {
    // 每次 addReadingTime 之后先 flush：动态 import 在同一 tick 内并发调用会被
    // Vitest 的 SSR module runner 判为重入而拒绝（浏览器里同一 specifier 会去重），
    // 生产路径按 5s tick 串行触发，这里同样串行化以对齐真实调用节奏。
    addReadingTime("spot", "a", 30);
    await flushAsync();
    addReadingTime("spot", "a", 15);
    await flushAsync();

    expect(readReadingTime()).toEqual({ "spot/a": 45 });
    expect(studyTime).toHaveBeenCalledTimes(2);
    expect(studyTime).toHaveBeenNthCalledWith(1, "read", 30);
    expect(studyTime).toHaveBeenNthCalledWith(2, "read", 15);
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
    "忽略非正或非有限秒数 %s",
    async (seconds) => {
      addReadingTime("spot", "a", seconds);

      expect(readReadingTime()).toEqual({});
      await flushAsync();
      expect(studyTime).not.toHaveBeenCalled();
    },
  );

  it("localStorage 写入失败时静默降级但仍记入台账", async () => {
    const setItem = vi
      .spyOn(localStorage, "setItem")
      .mockImplementation(() => {
        throw new Error("quota exceeded");
      });

    expect(() => addReadingTime("spot", "a", 10)).not.toThrow();
    setItem.mockRestore();

    await flushAsync();
    expect(studyTime).toHaveBeenCalledWith("read", 10);
  });

  it("学习时长台账上报抛错时不产生未处理拒绝", async () => {
    studyTime.mockImplementation(() => {
      throw new Error("ledger exploded");
    });

    expect(() => addReadingTime("spot", "a", 10)).not.toThrow();
    await flushAsync();
    // 抛错的 Promise 已被 .catch 吞掉：进程未崩溃即通过
    expect(studyTime).toHaveBeenCalledWith("read", 10);
  });
});
