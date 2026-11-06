"use client";

/** Dashboard (T012/US4). Redirects to content when authed, login when not. */
import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { LoadingState } from "@/components/ErrorState";
import { useAuth } from "@/lib/auth";

function HomeInner() {
  const { principal, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(principal ? "/content/" : "/login?returnTo=%2F");
  }, [loading, principal, router]);

  return <LoadingState />;
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingState />}>
      <HomeInner />
    </Suspense>
  );
}
