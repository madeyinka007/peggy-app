import Link from "next/link";

const CARDS = [
  { href: "/content/", title: "Content Manager", hint: "Browse, create, publish and localize documents." },
  { href: "/media/", title: "Media Library", hint: "Upload, organize and reuse assets." },
  { href: "/content-types/", title: "Content-Type Builder", hint: "Model collections, singles and components." },
  { href: "/users/", title: "Users", hint: "Invite, activate and assign roles." },
  { href: "/roles/", title: "Roles", hint: "Define permissions per resource." },
  { href: "/settings/", title: "Settings", hint: "Locales, tokens and project configuration." },
];

export default function Home() {
  return (
    <main style={{ padding: "1rem 1.5rem", maxWidth: 1100 }}>
      <h1>Peggy Admin</h1>
      <p style={{ color: "#555" }}>Model content, manage entries and media, and administer access.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.75rem" }}>
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            style={{
              display: "block",
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: "1rem",
              textDecoration: "none",
              color: "inherit",
              background: "#fff",
            }}
          >
            <strong>{c.title}</strong>
            <p style={{ margin: "0.4rem 0 0", color: "#555", fontSize: "0.9rem" }}>{c.hint}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
