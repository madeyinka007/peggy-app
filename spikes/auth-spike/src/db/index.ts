import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pg = require("pg");
const { Pool } = pg;
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
export { pool };
