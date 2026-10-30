import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { toNodeHandler } from "better-auth/node";
import { createLogger } from "@peggy/shared";
import type { AuthInstance } from "./types.js";
import type { DbClient } from "@peggy/db";
import { checkRateLimit } from "./rate-limit.js";

export interface CreateAppOptions {
  auth?: AuthInstance;
  readyCheck?: () => Promise<boolean>;
  routes?: (app: Express) => void;
  /** Postgres-backed store for rate-limit counters (Constitution VI). */
  rateLimitStore?: DbClient;
}

export function createApp(opts: CreateAppOptions = {}): Express {
  const app = express();
  const log = createLogger();

  // CORS — allowlist only; never "*" with credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowed = (process.env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (origin && allowed.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.status(204).end();
      return;
    }
    next();
  });


  // Rate limiting for auth routes (lambda preset: 5 req/min/IP).
  // Counters live in Postgres via opts.rateLimitStore (Constitution VI).
  // Falls back to a process-local bucket only when no store is provided
  // (local dev without DB); Lambda always passes the store.
  const fallbackBuckets = new Map<string, { count: number; reset: number }>();
  app.use("/api/auth", (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const key = `auth:${ip}`;
    const store = opts.rateLimitStore;
    if (!store) {
      const now = Date.now();
      const bucket = fallbackBuckets.get(ip);
      if (!bucket || bucket.reset < now) {
        fallbackBuckets.set(ip, { count: 1, reset: now + 60_000 });
        return next();
      }
      if (bucket.count >= 5) {
        res.status(429).json({ error: "Too many requests" });
        return;
      }
      bucket.count += 1;
      return next();
    }
    void checkRateLimit(store, key, 5, 60_000).then(
      (r) => {
        if (!r.allowed) res.status(429).json({ error: "Too many requests" });
        else next();
      },
      (err) => {
        log.error("rate-limit check failed", { error: err instanceof Error ? err.message : String(err) });
        next();
      },
    );
  });

  // Better Auth mount — MUST be before express.json() (handler consumes raw body)
  if (opts.auth) {
    app.all("/api/auth/*", toNodeHandler(opts.auth as Parameters<typeof toNodeHandler>[0]));
  }

  // 413 guard for direct-to-API uploads — MUST be before express.json()
  // (express.json limit is 1mb, which would reject large uploads with a generic
  // error before the media route's signedFlow guidance ever fires). Header-only,
  // no bytes buffered. Per FR-003 / SC-001.
  app.use((req, res, next) => {
    if (
      req.method === "POST" &&
      (req.path === "/api/v1/media" || req.path === "/api/v1/media/")
    ) {
      const len = Number(req.headers["content-length"] ?? 0);
      if (len > 10 * 1024 * 1024) {
        res.status(413).json({
          error: {
            code: "PAYLOAD_TOO_LARGE",
            message: "Use signed upload flow",
            signedFlow: "POST /api/v1/media/sign",
          },
        });
        return;
      }
    }
    next();
  });

  app.use(express.json({ limit: "1mb" }));

  // Feature routes (registered after body parsing)
  if (opts.routes) opts.routes(app);

  // Health endpoints
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/ready", async (_req, res) => {
    let dbOk = true;
    if (opts.readyCheck) {
      try { dbOk = await opts.readyCheck(); } catch { dbOk = false; }
    }
    const status = dbOk ? 200 : 503;
    res.status(status).json({ status: dbOk ? "ready" : "not_ready", db: dbOk });
  });

  // Error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    log.error("unhandled error", { error: err instanceof Error ? err.message : String(err) });
    const statusCode = (err as { statusCode?: number })?.statusCode ?? 500;
    res.status(statusCode).json({ error: "Internal server error" });
  });

  return app;
}
