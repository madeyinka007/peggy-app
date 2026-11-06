"use client";

/**
 * Locale switcher (T017/US1). Lists locales from the registry with the
 * default locale; switching loads that locale's version. A missing row
 * renders an "untranslated" badge — never en data as another locale (FR-005).
 */
import type { Locale } from "@/lib/types";

export interface LocaleSwitcherProps {
  locales: Locale[];
  value: string;
  onChange: (code: string) => void;
  translationState?: "present" | "missing" | undefined;
  disabled?: boolean | undefined;
}

export function LocaleSwitcher({
  locales,
  value,
  onChange,
  translationState,
  disabled,
}: LocaleSwitcherProps) {
  return (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
      <label htmlFor="locale-switcher">Locale</label>
      <select
        id="locale-switcher"
        value={value}
        disabled={disabled || locales.length === 0}
        onChange={(e) => onChange(e.target.value)}
      >
        {locales.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name ?? l.code}
            {l.isDefault ? " (default)" : ""}
          </option>
        ))}
      </select>
      {translationState === "missing" ? (
        <span
          role="status"
          style={{
            border: "1px solid #a60",
            color: "#a60",
            borderRadius: 4,
            padding: "0.1rem 0.5rem",
            fontSize: "0.85rem",
          }}
        >
          Untranslated
        </span>
      ) : null}
    </div>
  );
}
