/** 本地错题本 + 云端双写：key = `${chapterNum}:${questionIdx}`，答对后移出 */

import { syncWrongbookWrite, syncWrongbookDelete } from "./sync-layer";

const KEY = "tb-wrong";

export interface WrongEntry {
  chapterNum: string;
  questionIdx: number;
  picked: number;
  at: number;
}

export function readWrong(): Record<string, WrongEntry> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<
      string,
      WrongEntry
    >;
  } catch {
    return {};
  }
}

export function recordWrong(chapterNum: string, questionIdx: number, picked: number) {
  const w = readWrong();
  w[`${chapterNum}:${questionIdx}`] = { chapterNum, questionIdx, picked, at: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(w));
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new Event("tb-progress"));
  } catch {
    // ignore
  }
  syncWrongbookWrite(chapterNum, questionIdx, picked);
}

export function resolveWrong(chapterNum: string, questionIdx: number) {
  const w = readWrong();
  delete w[`${chapterNum}:${questionIdx}`];
  try {
    localStorage.setItem(KEY, JSON.stringify(w));
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new Event("tb-progress"));
  } catch {
    // ignore
  }
  syncWrongbookDelete(chapterNum, questionIdx);
}
