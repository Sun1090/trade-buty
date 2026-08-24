import { touchStreak } from "./streak";

export function tryDispatchProgressEvent() {
  try {
    touchStreak(); // 记录学习活动到连续天数
    window.dispatchEvent(new Event("tb-progress"));
  } catch {
    // ignore
  }
}
