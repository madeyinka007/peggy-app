"use client";

/**
 * Per-locale publish controls (T018/US1). Confirmation step, locale-scoped
 * POST /:id/publish and POST /:id/unpublish; hidden without
 * `document.publish`; badge updates only after the server round-trip
 * (the parent re-renders from onChanged); 403 ⇒ inline "not permitted" notice;
 * 401 ⇒ login redirect with return-to (R-07, T033).
 */
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getDocument, publishDocument, unpublishDocument } from "@/lib/api-client";
import { isUnauthorized } from "@/lib/types";
import type { DocumentRow, DocumentStatus } from "@/lib/types";

export interface PublishControlsProps {
  documentId: string | null | undefined;
  locale: string;
  status: DocumentStatus;
  canPublish: boolean;
  onChanged: (row: DocumentRow) => void;
}

type Confirming = "publish" | "unpublish" | null;

export function PublishControls({
  documentId,
  locale,
  status,
  canPublish,
  onChanged,
}: PublishControlsProps) {
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const id = documentId;
  if (!id || !canPublish) return null;

  async function run(action: "publish" | "unpublish") {
    if (!id) return;
    setBusy(true);
    setNotice(null);
    try {
      if (action === "publish") await publishDocument(id, locale);
      else await unpublishDocument(id, locale);
      // Badge updates only after the server round-trip: re-fetch the row.
      const fresh = await getDocument(id, locale);
      setConfirming(null);
      onChanged(fresh);
    } catch (e) {
      if (isUnauthorized(e)) {
        // R-07: publish carries no form payload, so location (via
        // return-to) is the retained state; the badge simply stays stale.
        const returnTo = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
        router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      } else if (
        typeof e === "object" &&
        e !== null &&
        (e as { status?: unknown }).status === 403
      ) {
        setNotice("Not permitted: you lack document.publish for this action.");
      } else {
        setNotice(e instanceof Error ? e.message : "Publish request failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  const action: "publish" | "unpublish" = status === "published" ? "unpublish" : "publish";

  return (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
      {confirming === null ? (
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setConfirming(action);
          }}
          style={{ cursor: "pointer" }}
        >
          {action === "publish" ? `Publish (${locale})` : `Unpublish (${locale})`}
        </button>
      ) : (
        <span>
          {confirming === "publish" ? `Publish the ${locale} version?` : `Unpublish the ${locale} version?`}{" "}
          <button type="button" disabled={busy} onClick={() => void run(confirming)} style={{ cursor: "pointer" }}>
            {busy ? "Working…" : "Confirm"}
          </button>{" "}
          <button type="button" disabled={busy} onClick={() => setConfirming(null)} style={{ cursor: "pointer" }}>
            Cancel
          </button>
        </span>
      )}
      {notice ? (
        <span role="alert" style={{ color: "#900" }}>
          {notice}
        </span>
      ) : null}
    </div>
  );
}
