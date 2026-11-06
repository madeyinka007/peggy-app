"use client";

/**
 * Shared loading / error / empty states (T008). Every API failure renders
 * through ErrorState with retry where applicable; requestId only when present.
 */
import type { ApiError } from "@/lib/types";

function messageOf(error: unknown): { status?: number | undefined; code?: string | undefined; message: string; requestId?: string | undefined } {
  if (error !== null && typeof error === "object") {
    const e = error as Partial<ApiError>;
    return {
      status: typeof e.status === "number" ? e.status : undefined,
      code: e.code,
      message: e.message ?? "Something went wrong.",
      requestId: e.requestId,
    };
  }
  return { message: error instanceof Error ? error.message : "Something went wrong." };
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" style={{ padding: "2rem", textAlign: "center", color: "#555" }}>
      {label}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ padding: "2rem", textAlign: "center", color: "#555" }}>
      <p style={{ fontWeight: 600 }}>{title}</p>
      {hint ? <p style={{ fontSize: "0.9rem" }}>{hint}</p> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { status, code, message, requestId } = messageOf(error);
  return (
    <div
      role="alert"
      style={{
        padding: "1.5rem",
        border: "1px solid #c00",
        borderRadius: 8,
        background: "#fff5f5",
        color: "#900",
        maxWidth: 640,
      }}
    >
      <p style={{ fontWeight: 700, margin: "0 0 0.5rem" }}>
        {status ? `Request failed (${status})` : "Something went wrong"}
        {code ? ` · ${code}` : ""}
      </p>
      <p style={{ margin: "0 0 0.5rem", wordBreak: "break-word" }}>{message}</p>
      {requestId ? (
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem" }}>
          Request ID: <code>{requestId}</code>
        </p>
      ) : null}
      {onRetry ? (
        <button type="button" onClick={onRetry} style={{ padding: "0.4rem 0.9rem", cursor: "pointer" }}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
