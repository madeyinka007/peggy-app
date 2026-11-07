/**
 * Auth + sidebar behavior tests. Mocks better-auth/react's
 * createAuthClient so no network is touched.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

const signInEmail = vi.fn();
const signOutFn = vi.fn();
let sessionState: { user: { id: string; email: string; name: string; isSuperAdmin: boolean } } | null =
  null;

vi.mock("better-auth/react", () => ({
  createAuthClient: () => ({
    useSession: () => ({ data: sessionState ? { user: sessionState.user } : null, isPending: false }),
    signIn: { email: (...args: unknown[]) => signInEmail(...args) },
    signOut: () => signOutFn(),
  }),
}));

vi.mock("@/lib/api-client", () => ({
  myPermissions: vi.fn().mockResolvedValue(null),
}));

import { AuthProvider, useAuth } from "@/lib/auth";
import { Nav } from "@/components/Nav";

function Probe() {
  const { can, principal } = useAuth();
  return (
    <div>
      <span data-testid="who">{principal ? principal.user.email : "anon"}</span>
      <span data-testid="types">{can("content-type.read") ? "yes" : "no"}</span>
    </div>
  );
}

function renderWithAuth(ui: ReactNode) {
  return render(<AuthProvider>{ui}</AuthProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionState = null;
});

describe("auth gating", () => {
  it("anonymous user sees no admin section and cannot access it", () => {
    renderWithAuth(
      <>
        <Nav />
        <Probe />
      </>,
    );
    expect(screen.getByTestId("who").textContent).toBe("anon");
    expect(screen.queryByRole("link", { name: "Content-Type Builder" })).toBeNull();
    expect(screen.getByTestId("types").textContent).toBe("no");
  });

  it("author (non-admin, no permissions resolved) sees Content + Media only", async () => {
    sessionState = { user: { id: "u1", email: "author@example.com", name: "A", isSuperAdmin: false } };
    renderWithAuth(<Nav />);
    expect(screen.getByRole("link", { name: "Content Manager" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Media Library" })).toBeTruthy();
    // myPermissions() mock resolves null → progressive disclosure settles to hidden.
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Content-Type Builder" })).toBeNull(),
    );
    // Administration sections stay hidden too.
    expect(screen.queryByRole("link", { name: "Users" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Roles" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
  });

  it("super-admin sees all sections", () => {
    sessionState = { user: { id: "u9", email: "root@example.com", name: "R", isSuperAdmin: true } };
    renderWithAuth(
      <>
        <Nav />
        <Probe />
      </>,
    );
    expect(screen.getByRole("link", { name: "Content Manager" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Media Library" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Content-Type Builder" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Users" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Roles" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy();
    expect(screen.getByTestId("types").textContent).toBe("yes");
  });

  it("failed login surfaces a generic message and clears the password", async () => {
    sessionState = null;
    signInEmail.mockResolvedValue({ error: { message: "bad" } });
    const { default: LoginPage } = await import("@/app/login/page");
    render(<AuthProvider><LoginPage /></AuthProvider>);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "a@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
  });
});
