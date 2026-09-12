"use client";

import { useSyncExternalStore } from "react";
import { getNetworkQuality, type NetworkQuality } from "@/lib/network-quality";

interface NetworkInformationLike {
  effectiveType?: string;
  saveData?: boolean;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformationLike;
}

function connectionInfo(): NetworkInformationLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as NavigatorWithConnection).connection;
}

function getNetworkQualitySnapshot(): NetworkQuality {
  if (typeof navigator === "undefined") return "online";
  const connection = connectionInfo();
  return getNetworkQuality({
    online: navigator.onLine,
    effectiveType: connection?.effectiveType,
    saveData: connection?.saveData,
  });
}

function getServerNetworkQualitySnapshot(): NetworkQuality {
  return "online";
}

function subscribeToNetworkQuality(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const connection = connectionInfo();
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  connection?.addEventListener?.("change", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
    connection?.removeEventListener?.("change", onChange);
  };
}

/**
 * Reactive, SSR-safe network quality with a stable string snapshot.
 * Browser support is optional; unsupported APIs fail open to `online`.
 */
export function useNetworkQuality(): NetworkQuality {
  return useSyncExternalStore(
    subscribeToNetworkQuality,
    getNetworkQualitySnapshot,
    getServerNetworkQualitySnapshot,
  );
}
