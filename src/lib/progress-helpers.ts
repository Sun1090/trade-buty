export function tryDispatchProgressEvent() {
  try {
    window.dispatchEvent(new Event("tb-progress"));
  } catch {
    // ignore
  }
}
