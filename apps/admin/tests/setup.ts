import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());

// Module-level apiBase() in lib/auth.tsx reads this at import time.
process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:3100";

// next/navigation only works inside a Next runtime — stub the router hooks.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
