import type { DbClient } from "@peggy/db";

// Postgres-backed fixed-window rate limiter (Constitution VI: counters live
// in Postgres, never in process memory). Window comparison happens in SQL
// (NOW() - make_interval) so container/host clock skew can't shrink the window.
export async function checkRateLimit(
  db: DbClient,
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; count: number }> {
  const windowSecs = Math.max(1, Math.floor(windowMs / 1000));
  const rows = await db.query<{ count: number; fresh: boolean }>(
    `SELECT count,
       (window_start > NOW() - make_interval(secs => $2)) AS fresh
     FROM rate_limits WHERE key = $1`,
    [key, windowSecs],
  );
  const row = rows[0];
  if (!row || !row.fresh) {
    await db.query(
      `INSERT INTO rate_limits (key, count, window_start, updated_at)
       VALUES ($1, 1, NOW(), NOW())
       ON CONFLICT (key) DO UPDATE SET count = 1, window_start = NOW(), updated_at = NOW()`,
      [key],
    );
    return { allowed: true, count: 1 };
  }
  if (row.count >= limit) return { allowed: false, count: row.count };
  const updated = await db.query<{ count: number }>(
    "UPDATE rate_limits SET count = count + 1, updated_at = NOW() WHERE key = $1 RETURNING count",
    [key],
  );
  return { allowed: true, count: updated[0]?.count ?? row.count + 1 };
}
