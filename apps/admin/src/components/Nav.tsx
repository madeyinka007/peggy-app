"use client";

/**
 * Strapi-parity sidebar shell. Left navigation grouped into sections
 * (Content · Builder · Administration) instead of the old top bar.
 * Section entries gate on the same permission strings as their pages —
 * a section renders only when at least one entry is visible.
 * Entries without a `permission` (Content Manager, Media Library) stay
 * visible to any signed-in user, matching Strapi's always-present core.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

interface NavEntry {
  href: string;
  label: string;
  /** Required permission; omitted = visible to everyone. */
  permission?: string | undefined;
  /** Dashboard matches exactly; everything else matches by prefix. */
  exact?: boolean | undefined;
}

interface NavSection {
  title: string;
  entries: NavEntry[];
}

const SECTIONS: NavSection[] = [
  {
    title: "Content",
    entries: [
      { href: "/", label: "Dashboard", exact: true },
      { href: "/content/", label: "Content Manager" },
      { href: "/media/", label: "Media Library" },
    ],
  },
  {
    title: "Builder",
    entries: [{ href: "/content-types/", label: "Content-Type Builder", permission: "content-type.read" }],
  },
  {
    title: "Administration",
    entries: [
      { href: "/users/", label: "Users", permission: "users.manage" },
      { href: "/roles/", label: "Roles", permission: "roles.manage" },
      { href: "/settings/", label: "Settings", permission: "settings.manage" },
    ],
  },
];

function normalize(path: string): string {
  return path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path;
}

function isActive(entry: NavEntry, pathname: string): boolean {
  const here = normalize(pathname);
  const target = normalize(entry.href);
  if (entry.exact) return here === target;
  return here === target || here.startsWith(`${target}/`);
}

export function Nav() {
  const { principal, can, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  async function onSignOut() {
    await signOut();
    router.push("/login");
  }

  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    entries: section.entries.filter((e) => !e.permission || can(e.permission)),
  })).filter((section) => section.entries.length > 0);

  return (
    <nav
      aria-label="Admin"
      style={{
        width: 240,
        flexShrink: 0,
        borderRight: "1px solid #ddd",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#fafafa",
      }}
    >
      <div style={{ padding: "1rem 1rem 0.5rem", fontWeight: 800, fontSize: "1.1rem" }}>Peggy</div>
      <div style={{ flex: 1, padding: "0.5rem 0.5rem 1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        {visibleSections.map((section) => (
          <div key={section.title}>
            <div
              style={{
                padding: "0 0.5rem 0.25rem",
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#777",
              }}
            >
              {section.title}
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {section.entries.map((entry) => {
                const active = isActive(entry, pathname);
                return (
                  <li key={entry.href}>
                    <Link
                      href={entry.href}
                      aria-current={active ? "page" : undefined}
                      style={{
                        display: "block",
                        padding: "0.45rem 0.5rem",
                        borderRadius: 6,
                        textDecoration: "none",
                        color: active ? "#111" : "#333",
                        background: active ? "#e8eefc" : "transparent",
                        fontWeight: active ? 700 : 400,
                      }}
                    >
                      {entry.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px solid #ddd", padding: "0.75rem 1rem" }}>
        <div style={{ color: "#555", fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis" }}>
          {principal ? principal.user.email : ""}
        </div>
        {principal ? (
          <button type="button" onClick={onSignOut} style={{ cursor: "pointer", marginTop: "0.4rem" }}>
            Sign out
          </button>
        ) : null}
      </div>
    </nav>
  );
}
