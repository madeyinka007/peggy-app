"use client";

/**
 * Users section stub (Strapi parity: Users under Administration).
 * Lists no one yet: there is no backing read endpoint (only
 * POST/DELETE /api/v1/users/:userId/roles assignments exist), so this
 * page documents the gap and the contract the backend must grow:
 * `GET /api/v1/users` (+ `GET /api/v1/users/:id`) gated on `users.manage`.
 */
import { EmptyState } from "@/components/ErrorState";
import { RouteGuard } from "@/components/RouteGuard";

export default function UsersPage() {
  return (
    <RouteGuard requiredPermission="users.manage">
      <main style={{ padding: "1rem 1.5rem", maxWidth: 1100 }}>
        <h1>Users</h1>
        <EmptyState
          title="User management is not available yet"
          hint="The API exposes role assignment only (POST/DELETE /api/v1/users/:userId/roles). Listing and administering users needs GET /api/v1/users and GET /api/v1/users/:id gated on users.manage."
        />
      </main>
    </RouteGuard>
  );
}
