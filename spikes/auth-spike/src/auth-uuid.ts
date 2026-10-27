import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "./db/index-uuid.js";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3098",
  trustedOrigins: ["http://localhost:3098", "http://localhost:3097"],
  secret: process.env.BETTER_AUTH_SECRET ?? "spike-secret-please-change-32chars-min",
  advanced: { database: { generateId: false } },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 300, strategy: "jwe" },
  },
});
