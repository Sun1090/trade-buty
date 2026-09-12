// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

type EventListener = (event: string, session: unknown) => void;

const h = vi.hoisted(() => {
  const state = {
    hasEnv: true,
    session: null as { user: { id: string; email: string | null } } | null,
    listeners: [] as EventListener[],
  };
  return {
    state,
    setAuthState: vi.fn<(...args: unknown[]) => void>(),
    hydrateFromCloud: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
    unsubscribe: vi.fn(),
    getBrowser: vi.fn(() => ({
      auth: {
        getSession: async () => ({ data: { session: state.session } }),
        onAuthStateChange: (callback: EventListener) => {
          state.listeners.push(callback);
          return {
            data: { subscription: { unsubscribe: h.unsubscribe } },
          };
        },
      },
    })),
    touchLastVisit: vi.fn<(...args: unknown[]) => void>(),
    getLastVisitAt: vi.fn<() => number | null>(() => null),
    shouldShowReturnNudge: vi.fn<(...args: unknown[]) => boolean>(() => false),
    flushPersistedQueue: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
    buildQueueExecutor: vi.fn<(...args: unknown[]) => () => void>(() => () => undefined),
  };
});

vi.mock("@/lib/supabase/client", () => ({
  hasSupabaseEnv: () => h.state.hasEnv,
  getSupabaseBrowser: () => h.getBrowser(),
}));
vi.mock("@/lib/sync-layer", () => ({
  setAuthState: (...args: unknown[]) => h.setAuthState(...args),
  hydrateFromCloud: (...args: unknown[]) => h.hydrateFromCloud(...args),
}));
vi.mock("@/lib/last-visit", () => ({
  touchLastVisit: (...args: unknown[]) => h.touchLastVisit(...args),
  getLastVisitAt: () => h.getLastVisitAt(),
  shouldShowReturnNudge: (...args: unknown[]) => h.shouldShowReturnNudge(...args),
}));
vi.mock("@/lib/sync-queue-store", () => ({
  flushPersistedQueue: (...args: unknown[]) => h.flushPersistedQueue(...args),
  enqueueWrite: vi.fn(),
}));
vi.mock("@/lib/sync-queue-executor", () => ({
  buildQueueExecutor: (...args: unknown[]) => h.buildQueueExecutor(...args),
}));

import { AuthProvider, useAuth } from "./auth-provider";

function Probe() {
  const user = useAuth();
  return (
    <span data-testid="user">
      {user ? `${user.id}|${user.email}` : "anon"}
    </span>
  );
}

beforeEach(() => {
  h.state.hasEnv = true;
  h.state.session = null;
  h.state.listeners = [];
  h.setAuthState.mockClear();
  h.hydrateFromCloud.mockClear();
  h.unsubscribe.mockClear();
  h.getBrowser.mockClear();
  h.touchLastVisit.mockClear();
  h.getLastVisitAt.mockReset();
  h.getLastVisitAt.mockReturnValue(null);
  h.shouldShowReturnNudge.mockReset();
  h.shouldShowReturnNudge.mockReturnValue(false);
  h.flushPersistedQueue.mockClear();
  h.buildQueueExecutor.mockClear();
});

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

describe("AuthProvider", () => {
  it("stays in local-only mode when Supabase env is absent", async () => {
    h.state.hasEnv = false;
    renderProvider();
    await waitFor(() => expect(h.setAuthState).toHaveBeenCalledWith(false));
    expect(h.getBrowser).not.toHaveBeenCalled();
    expect(screen.getByTestId("user")).toHaveTextContent("anon");
  });

  it("exposes an existing session and hydrates it from the cloud", async () => {
    h.state.session = { user: { id: "u1", email: "learner@example.com" } };
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("user")).toHaveTextContent(
        "u1|learner@example.com",
      ),
    );
    expect(h.setAuthState).toHaveBeenCalledWith(true, "u1");
    expect(h.hydrateFromCloud).toHaveBeenCalledWith("u1");
  });

  it("keeps the email null when the session omits it", async () => {
    h.state.session = { user: { id: "u2", email: null } };
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("u2|"));
    expect(h.setAuthState).toHaveBeenCalledWith(true, "u2");
  });

  it("reacts to SIGNED_IN from the auth listener", async () => {
    renderProvider();
    await waitFor(() => expect(h.state.listeners.length).toBe(1));
    act(() => {
      for (const listener of h.state.listeners) {
        listener("SIGNED_IN", { user: { id: "u3", email: "c@d.e" } });
      }
    });
    await waitFor(() =>
      expect(screen.getByTestId("user")).toHaveTextContent("u3|c@d.e"),
    );
    expect(h.hydrateFromCloud).toHaveBeenCalledWith("u3");
  });

  it("clears the user and auth state on SIGNED_OUT", async () => {
    h.state.session = { user: { id: "u4", email: null } };
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("u4|"));

    act(() => {
      for (const listener of h.state.listeners) listener("SIGNED_OUT", null);
    });
    expect(screen.getByTestId("user")).toHaveTextContent("anon");
    expect(h.setAuthState).toHaveBeenCalledWith(false);
  });

  it("unsubscribes the auth listener on unmount", async () => {
    const { unmount } = renderProvider();
    await waitFor(() => expect(h.state.listeners.length).toBe(1));
    unmount();
    expect(h.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("records the visit and nudges returning learners", async () => {
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    h.getLastVisitAt.mockReturnValue(Date.now() - thirtyDays);
    h.shouldShowReturnNudge.mockReturnValue(true);

    const events: CustomEvent[] = [];
    const listener = (event: Event) => events.push(event as CustomEvent);
    window.addEventListener("tb-return-nudge", listener);
    try {
      renderProvider();
      await waitFor(() => expect(events.length).toBe(1));
      expect(events[0].detail).toEqual({ days: 30 });
      expect(h.touchLastVisit).toHaveBeenCalledTimes(1);
      expect(window.sessionStorage.getItem("tb-return-nudge-pending")).toBe("1");
    } finally {
      window.removeEventListener("tb-return-nudge", listener);
      window.sessionStorage.clear();
    }
  });

  it("does not nudge a first-time visitor", async () => {
    const listener = vi.fn();
    window.addEventListener("tb-return-nudge", listener);
    try {
      renderProvider();
      await waitFor(() => expect(h.touchLastVisit).toHaveBeenCalled());
      expect(h.shouldShowReturnNudge).not.toHaveBeenCalled();
      expect(listener).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("tb-return-nudge", listener);
    }
  });
});
