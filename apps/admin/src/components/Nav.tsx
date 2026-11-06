"use client";

/** Permission-gated navigation (T012/US4). Super-admins see everything. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export function Nav() {
  const { principal, can, signOut } = useAuth();
  const router = useRouter();

  async function onSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <nav
      aria-label="Admin"
      style={{ display: "flex", gap: "1rem", alignItems: "center", padding: "0.75rem 1rem", borderBottom: "1px solid #ddd" }}
    >
      <strong>Peggy</strong>
      <Link href="/">Dashboard</Link>
      <Link href="/content/">Content</Link>
      <Link href="/media/">Media</Link>
      {can("content-type.read") ? <Link href="/content-types/">Content-Types</Link> : null}
      <span style={{ marginLeft: "auto", color: "#555", fontSize: "0.9rem" }}>
        {principal ? principal.user.email : ""}
      </span>
      {principal ? (
        <button type="button" onClick={onSignOut} style={{ cursor: "pointer" }}>
          Sign out
        </button>
      ) : null}
    </nav>
  );
}
