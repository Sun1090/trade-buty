import "@testing-library/jest-dom/vitest";

// jsdom 不支持 scrollIntoView（node 环境跳过）
if (typeof Element !== "undefined") {
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.scrollTo = () => {};
}
