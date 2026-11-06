"use client";

/**
 * Cached registry loader (T007). Loads content-types, components and locales
 * once per session; exposes getType(id) with fields and refreshType(id) for
 * the mid-edit activeSchemaVersion re-check.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { listComponents, listContentTypes, listLocales } from "@/lib/api-client";
import type { Locale, RegistryComponent, RegistryView } from "@/lib/types";

export interface RegistrySnapshot {
  types: RegistryView[];
  components: RegistryComponent[];
  locales: Locale[];
  loading: boolean;
  error: unknown;
  getType: (id: string) => RegistryView | undefined;
  refreshType: (id: string) => Promise<RegistryView | undefined>;
  /** T034: re-run the initial load (retry after a registry failure). */
  reload: () => void;
  defaultLocale: string;
}

export function useRegistry(): RegistrySnapshot {
  const [types, setTypes] = useState<RegistryView[]>([]);
  const [components, setComponents] = useState<RegistryComponent[]>([]);
  const [locales, setLocales] = useState<Locale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [t, c, l] = await Promise.all([listContentTypes(), listComponents(), listLocales()]);
        if (!live) return;
        setTypes(t.data);
        setComponents(c.data);
        setLocales(l.data);
      } catch (e) {
        if (live) setError(e);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const getType = useCallback(
    (id: string) => types.find((t) => t.id === id || t.name === id),
    [types],
  );

  const refreshType = useCallback(async (id: string) => {
    const { getContentType } = await import("@/lib/api-client");
    const fresh = await getContentType(id);
    setTypes((prev) => {
      const i = prev.findIndex((t) => t.id === fresh.id);
      if (i < 0) return [...prev, fresh];
      const next = [...prev];
      next[i] = fresh;
      return next;
    });
    return fresh;
  }, []);

  const defaultLocale = useMemo(
    () => locales.find((l) => l.isDefault)?.code ?? locales[0]?.code ?? "en",
    [locales],
  );

  return { types, components, locales, loading, error, getType, refreshType, reload, defaultLocale };
}
