// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useNetworkQuality } from "./use-network-quality";

interface FakeConnection {
  effectiveType?: string;
  saveData?: boolean;
  listeners: Set<() => void>;
  addEventListener: (type: "change", listener: () => void) => void;
  removeEventListener: (type: "change", listener: () => void) => void;
}

function fakeConnection(init: { effectiveType?: string; saveData?: boolean } = {}): FakeConnection {
  const listeners = new Set<() => void>();
  return {
    effectiveType: init.effectiveType,
    saveData: init.saveData,
    listeners,
    addEventListener: (_type, listener) => void listeners.add(listener),
    removeEventListener: (_type, listener) => void listeners.delete(listener),
  };
}

/** 用一个可变的闭包值模拟 navigator.onLine / navigator.connection。 */
function stubNavigator(options: { online: boolean; connection?: FakeConnection }) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => options.online,
  });
  Object.defineProperty(window.navigator, "connection", {
    configurable: true,
    get: () => options.connection,
  });
  return options;
}

const originalOnLine = Object.getOwnPropertyDescriptor(window.navigator, "onLine");
const originalConnection = Object.getOwnPropertyDescriptor(window.navigator, "connection");

beforeEach(() => {
  stubNavigator({ online: true });
});

afterEach(() => {
  if (originalOnLine) Object.defineProperty(window.navigator, "onLine", originalOnLine);
  else delete (window.navigator as { onLine?: boolean }).onLine;
  if (originalConnection) Object.defineProperty(window.navigator, "connection", originalConnection);
  else delete (window.navigator as { connection?: unknown }).connection;
});

describe("useNetworkQuality（失败即放行的网络质量订阅）", () => {
  it("没有 Network Information API 时保持 online", () => {
    const { result } = renderHook(() => useNetworkQuality());
    expect(result.current).toBe("online");
  });

  it("navigator.onLine === false → offline", () => {
    stubNavigator({ online: false });
    const { result } = renderHook(() => useNetworkQuality());
    expect(result.current).toBe("offline");
  });

  it("effectiveType 为 3g → slow", () => {
    stubNavigator({ online: true, connection: fakeConnection({ effectiveType: "3g" }) });
    const { result } = renderHook(() => useNetworkQuality());
    expect(result.current).toBe("slow");
  });

  it("saveData === true → slow", () => {
    stubNavigator({ online: true, connection: fakeConnection({ saveData: true }) });
    const { result } = renderHook(() => useNetworkQuality());
    expect(result.current).toBe("slow");
  });

  it("窗口 online/offline 事件触发重算", () => {
    const nav = stubNavigator({ online: false });
    const { result } = renderHook(() => useNetworkQuality());
    expect(result.current).toBe("offline");

    act(() => {
      nav.online = true;
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe("online");

    act(() => {
      nav.online = false;
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe("offline");
  });

  it("connection 的 change 事件触发重算", () => {
    const connection = fakeConnection({ effectiveType: "4g" });
    stubNavigator({ online: true, connection });
    const { result } = renderHook(() => useNetworkQuality());
    expect(result.current).toBe("online");

    act(() => {
      connection.effectiveType = "2g";
      connection.listeners.forEach((listener) => listener());
    });
    expect(result.current).toBe("slow");
  });

  it("卸载时退订窗口与 connection 监听，避免泄漏", () => {
    const connection = fakeConnection({ effectiveType: "4g" });
    stubNavigator({ online: true, connection });
    const { unmount } = renderHook(() => useNetworkQuality());
    expect(connection.listeners.size).toBe(1);

    unmount();
    expect(connection.listeners.size).toBe(0);
  });
});
