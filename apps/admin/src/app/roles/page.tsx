"use client";

/**
 * Roles section stub (Strapi parity: Roles under Administration).
 * The RBAC API (list/get/update roles, role↔permission assignment) already
 * exists; the admin grants UI against it has not been built yet.
 */
import { EmptyState } from "@/components/ErrorState";
import { RouteGuard } from "@/components/RouteGuard";

export default function RolesPage() {
  return (
    <RouteGuard requiredPermission="roles.manage">
      <main style={{ padding: "1rem 1.5rem", maxWidth: 1100 }}>
        <h1>Roles</h1>
        <EmptyState
          title="Role management is not available yet"
          hint="The API already supports roles (GET/POST /api/v1/roles, role-permission assignment). A grants matrix UI against those endpoints is still to be built."
        />
      </main>
    </RouteGuard>
  );
}
