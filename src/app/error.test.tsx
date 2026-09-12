// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ErrorPage from "./error";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("route ErrorPage", () => {
  it("reports the crash once as a fatal route error with its digest", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = Object.assign(new Error("segment crashed"), { digest: "digest-1" });

    render(<ErrorPage error={error} reset={() => undefined} />);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      "[err:fatal] route-error: segment crashed",
      { digest: "digest-1" }
    );
    expect(screen.getByText("ref: digest-1")).toBeInTheDocument();
  });

  it("keeps rendering the fallback and wires the retry button to reset", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reset = vi.fn();

    render(<ErrorPage error={new Error("boom")} reset={reset} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Something went wrong"
    );
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
