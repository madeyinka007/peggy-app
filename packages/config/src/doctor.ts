import { parseConfig } from "./env.js";

const SECRET_KEYS = /secret|key|token|password/i;

function mask(key: string, value: string): string {
  if (SECRET_KEYS.test(key)) return value ? "***REDACTED***" : "(empty)";
  return value;
}

export function doctor(env: NodeJS.ProcessEnv = process.env): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  try {
    const cfg = parseConfig(env);
    // extra checks
    if (cfg.BETTER_AUTH_SECRET.length < 32) errors.push("BETTER_AUTH_SECRET must be at least 32 characters");
    if (cfg.CORS_ORIGINS.includes("*") && cfg.CORS_ORIGINS.includes(",")) {
      errors.push("CORS_ORIGINS cannot mix wildcard with explicit origins");
    }
    // print summary
    console.log("Peggy doctor — environment check");
    console.log("================================");
    for (const [k, v] of Object.entries(cfg)) {
      console.log(`  ${k} = ${mask(k, String(v))}`);
    }
    if (errors.length) {
      console.log("\nErrors:");
      for (const e of errors) console.log(`  ✗ ${e}`);
      return { ok: false, errors };
    }
    console.log("\n✓ All checks passed");
    return { ok: true, errors: [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg);
    return { ok: false, errors: [msg] };
  }
}

// CLI entrypoint
if (process.argv[1]?.endsWith("doctor.js") || process.argv[1]?.endsWith("doctor.ts")) {
  const r = doctor();
  process.exit(r.ok ? 0 : 1);
}
