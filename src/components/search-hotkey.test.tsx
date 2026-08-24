// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { SearchHotkey } from "./search-hotkey";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// mock migrateStorage 避免 localStorage
vi.mock("@/lib/storage-migrate", () => ({
  migrateStorage: vi.fn(),
}));

describe("SearchHotkey", () => {
  it("渲染（不可见但挂载）", () => {
    const { container } = render(<SearchHotkey />);
    // SearchHotkey 渲染一个 hidden span 或 null
    expect(container).toBeTruthy();
  });
});
