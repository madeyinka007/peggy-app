import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  ADMIN_URL: z.string().url(),
  CORS_ORIGINS: z.string().min(1),
  COOKIE_DOMAIN: z.string().min(1),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  RATE_LIMIT_PRESET: z.enum(["lambda", "dev"]).default("lambda"),
  AUDIT_RETENTION_MONTHS: z.coerce.number().int().positive().default(12),
  WEBHOOK_WORKER_ENABLED: z.coerce.boolean().default(false),
  SESSION_EXPIRES_DAYS: z.coerce.number().int().positive().default(7),
  SESSION_UPDATE_AGE_H: z.coerce.number().int().positive().default(24),
  COOKIE_CACHE_S: z.coerce.number().int().positive().default(300),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.string().default("en"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Config = z.infer<typeof envSchema>;

export function parseConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Config validation failed:\n${issues}`);
  }
  return result.data;
}

let cached: Config | null = null;
export function getConfig(): Config {
  if (!cached) cached = parseConfig();
  return cached;
}

export function resetConfig() { cached = null; }
