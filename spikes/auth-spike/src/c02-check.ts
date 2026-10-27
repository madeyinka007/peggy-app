import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
// verify the password hash/verify option shape compiles
const pool = new Pool({ connectionString: "postgres://x" });
const db = drizzle(pool);
const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password: string) => "hashed-" + password,
      verify: async ({ password, hash }: { password: string; hash: string }) => hash === "hashed-" + password,
    },
  },
  additionalFields: {
    displayName: { type: "string", required: false },
    avatarAssetId: { type: "string", required: false },
    isActive: { type: "boolean", required: false, defaultValue: true },
    isSuperAdmin: { type: "boolean", required: false, defaultValue: false },
  },
});
console.log("C-02 option shapes compile OK");
export { auth };
