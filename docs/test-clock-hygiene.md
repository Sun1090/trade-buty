# 测试时钟卫生巡检（R14.6）

> 自动生成于 2026-09-24（`npm run check:test-clock-hygiene`），勿手改。

抖动的典型来源是断言直接读墙钟：结果取决于机器此刻是几点、跑多快。`quiz.test.tsx` 的学习时长
断言就是这么写的——单跑 <500ms 才成立，全量并行必现抖动。本巡检只列**可解释的两类模式**，
报告式不阻断（`await new Promise(r => setTimeout(r, 0))` 这类排空微任务的写法是合法的）。

- 判定口径 1 `clock-in-assertion`：`expect(...)` 语句里出现 `Date.now()` / `performance.now()`。
  这一类应当改为注入时钟或用 `vi.useFakeTimers()` + `setSystemTime()` 固定。
- 判定口径 2 `uncontrolled-timer`：使用真实 `setTimeout` / `setInterval` 且同文件从不使用受控时钟。
  这一类需要人工判断，逐条改或明确保留。

> 巡检器自己的单测（夹具里含有被检查模式的字符串）不参与扫描，见
> `test-clock-hygiene-lib.mjs` 的 `SELF_FIXTURES`。

## 汇总

- 扫描测试文件：302 个，命中文件：6 个
- clock-in-assertion：0
- uncontrolled-timer：6

| 口径 | 文件 | 行 | 片段 |
|---|---|---|---|
| uncontrolled-timer | scripts/check-dark-pattern-copy.test.mjs | 244 | ``setInterval(()=>{},1000); <input autoFocus defaultChecked />`,` |
| uncontrolled-timer | src/components/replay-trainer.test.tsx | 388 | `await new Promise((r) => setTimeout(r, tickMs * 2 + 200));` |
| uncontrolled-timer | src/lib/reading-time.test.ts | 14 | `const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));` |
| uncontrolled-timer | src/lib/sync-layer-queue.test.ts | 79 | `const flush = () => new Promise<void>((r) => setTimeout(r, 0));` |
| uncontrolled-timer | src/lib/sync-layer-write-failure.test.ts | 128 | `await new Promise((resolve) => setTimeout(resolve, 0));` |
| uncontrolled-timer | src/lib/sync-queue.test.ts | 112 | `await new Promise((r) => setTimeout(r, 1));` |

