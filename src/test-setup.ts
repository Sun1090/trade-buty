import { afterEach } from "vitest";

import "@testing-library/jest-dom/vitest";

// jsdom 不支持 scrollIntoView（node 环境跳过）
if (typeof Element !== "undefined") {
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.scrollTo = () => {};
}

// R7.7 CI 稳定性：flush react-dom 调度器的 pending 回调（setImmediate），
// 避免 jsdom 环境拆除后回调触发 "window is not defined" 的偶发 unhandled error
afterEach(async () => {
  await new Promise((resolve) => setImmediate(resolve));
});
