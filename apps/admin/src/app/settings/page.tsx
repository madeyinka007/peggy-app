"use client";

/**
 * Settings section stub (Strapi parity: Settings under Administration).
 * Locales, API tokens and project configuration surface here once the
 * backend exposes them under `settings.manage`-gated reads.
 */
import { EmptyState } from "@/components/ErrorState";
import { RouteGuard } from "@/components/RouteGuard";

export default function SettingsPage() {
  return (
    <RouteGuard requiredPermission="settings.manage">
      <main style={{ padding: "1rem 1.5rem", maxWidth: 1100 }}>
        <h1>Settings</h1>
        <EmptyState
          title="Settings are not available yet"
          hint="Locales, API tokens and project configuration will live here behind settings.manage."
        />
      </main>
    </RouteGuard>
  );
}
