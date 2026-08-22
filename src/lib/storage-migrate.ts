/** 一次性清理知识库重构前的旧格式 localStorage 数据（数字章节键已废弃） */
const CLEANED_KEY = "tb-migrated-v2";

export function migrateStorage() {
  try {
    if (localStorage.getItem(CLEANED_KEY)) return;

    // tb-progress：删除数字章节键
    const p = localStorage.getItem("tb-progress");
    if (p) {
      try {
        const obj = JSON.parse(p) as Record<string, unknown>;
        let touched = false;
        for (const k of Object.keys(obj)) {
          if (/^\d{2}$/.test(k)) {
            delete obj[k];
            touched = true;
          }
        }
        if (touched) localStorage.setItem("tb-progress", JSON.stringify(obj));
      } catch {
        localStorage.removeItem("tb-progress");
      }
    }

    // 错题本：数字键条目清除
    const w = localStorage.getItem("tb-wrong");
    if (w) {
      try {
        const obj = JSON.parse(w) as Record<string, unknown>;
        let touched = false;
        for (const k of Object.keys(obj)) {
          if (/^\d{2}:/.test(k)) {
            delete obj[k];
            touched = true;
          }
        }
        if (touched) localStorage.setItem("tb-wrong", JSON.stringify(obj));
      } catch {
        localStorage.removeItem("tb-wrong");
      }
    }

    // 旧数字键测验成绩
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && /^tb-quiz-\d{2}$/.test(k)) localStorage.removeItem(k);
    }

    localStorage.setItem(CLEANED_KEY, "1");
  } catch {
    // 存储不可用时静默跳过
  }
}
