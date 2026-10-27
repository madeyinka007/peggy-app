import serverless from "serverless-http";
import { createApp } from "@peggy/http";
import type { AuthInstance } from "@peggy/http";
import { createDbClient } from "@peggy/db";
import { createAuth } from "@peggy/auth";
import { parseConfig } from "@peggy/config";
import { rbacRouter } from "./routes/rbac.js";
import { tokensRouter } from "./routes/tokens.js";

const config = parseConfig();
const db = createDbClient(config.DATABASE_URL);
const auth = createAuth();

export const handler = serverless(
  createApp({
    auth: auth as AuthInstance,
    readyCheck: async () => {
      const h = await db.healthCheck();
      return h.ok;
    },
    rateLimitStore: db,
    routes: (app) => {
      app.use("/api/v1", rbacRouter);
      app.use("/api/v1", tokensRouter);
    },
  }),
  { binary: false },
);
