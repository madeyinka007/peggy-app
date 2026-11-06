"use client";

/** Route guard (T013/US4). Logged-out → login with return-to; unpermitted → forbidden state. */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { LoadingState } from "./ErrorState";
import { useAuth } from "@/lib/auth";

export function RouteGuard({
  children,
  requiredPermission,
}: {
  children: ReactNode;
  requiredPermission?: string;
}) {
  const { principal, loading, can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    if (loading) return;
    if (!principal) {
      const returnTo = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [loading, principal, pathname, params, router]);

  if (loading) return <LoadingState />;
  if (!principal) return <LoadingState label="Redirecting to login…" />;
  if (requiredPermission && !can(requiredPermission)) {
    return (
      <div role="alert" style={{ padding: "2rem" }}>
        <h2>Forbidden</h2>
        <p>You don’t have permission to view this section.</p>
      </div>
    );
  }
  return <>{children}</>;
}
