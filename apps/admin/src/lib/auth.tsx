"use client";

/**
 * Session context (T010/US4). Better Auth client with credentials:include;
 * permission resolution per R-04 (roles chain if it ever exists, else
 * progressive disclosure). 401 handling redirects to login with return-to
 * and stashes in-memory form drafts.
 */
import { createAuthClient } from "better-auth/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { myPermissions } from "./api-client";
import type { SessionPrincipal } from "./types";

function apiBase(): string {
  const v = process.env.NEXT_PUBLIC_API_URL;
  if (!v) throw new Error("NEXT_PUBLIC_API_URL is not set.");
  return v.replace(/\/$/, "");
}

export const authClient = createAuthClient({
  baseURL: apiBase(),
  fetchOptions: { credentials: "include" },
});

interface AuthState {
  principal: SessionPrincipal | null;
  loading: boolean;
  /** Draft payloads stashed when a 401 interrupts editing (R-07). */
  drafts: Record<string, unknown>;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; message: string | null }>;
  signOut: () => Promise<void>;
  can: (permission: string) => boolean;
  stashDraft: (key: string, value: unknown) => void;
  takeDraft: (key: string) => unknown;
}

const AuthContext = createContext<AuthState | null>(null);

function toPrincipal(session: {
  user: { id: string; email: string; name: string | null; isSuperAdmin?: boolean; isActive?: boolean };
}): SessionPrincipal {
  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      isSuperAdmin: session.user.isSuperAdmin ?? false,
      isActive: session.user.isActive ?? true,
    },
    permissions: [],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending, error } = authClient.useSession();
  // undefined = still resolving (progressive disclosure: allow);
  // string[] = resolved (empty = chain absent → deny admin sections).
  const [permissions, setPermissions] = useState<string[] | undefined>(undefined);
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  void error;

  const principal: SessionPrincipal | null = useMemo(() => {
    if (!session?.user) return null;
    const p = toPrincipal(session as Parameters<typeof toPrincipal>[0]);
    p.permissions = permissions ?? [];
    return p;
  }, [session, permissions]);

  useEffect(() => {
    if (!session?.user || permissions !== undefined) return;
    if ((session.user as { isSuperAdmin?: boolean }).isSuperAdmin) {
      setPermissions(["*"]);
      return;
    }
    let live = true;
    myPermissions(session.user.id).then((perms) => {
      // Chain absent (null) → deny admin sections; nav still shows
      // Content + Media. Mutations hide on 403 via cached negatives.
      if (live) setPermissions(perms ?? []);
    });
    return () => {
      live = false;
    };
  }, [session, permissions]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await authClient.signIn.email(
      { email, password },
      {
        onError: () => {},
      },
    );
    if (res.error) return { ok: false as const, message: "Invalid email or password." };
    return { ok: true as const, message: null };
  }, []);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    setPermissions(undefined);
    setDrafts({});
  }, []);

  const can = useCallback(
    (permission: string) => {
      if (!principal) return false;
      if (principal.user.isSuperAdmin) return true;
      if (permissions === undefined) return true; // still resolving: allow, hide on 403
      return permissions.includes("*") || permissions.includes(permission);
    },
    [principal, permissions],
  );

  const stashDraft = useCallback((key: string, value: unknown) => {
    setDrafts((d) => ({ ...d, [key]: value }));
  }, []);

  const takeDraft = useCallback(
    (key: string) => {
      const v = drafts[key];
      setDrafts((d) => {
        const next = { ...d };
        delete next[key];
        return next;
      });
      return v;
    },
    [drafts],
  );

  const value: AuthState = {
    principal,
    loading: isPending,
    drafts,
    signIn,
    signOut,
    can,
    stashDraft,
    takeDraft,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
