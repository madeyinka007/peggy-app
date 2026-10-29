import { createDbClient } from "@peggy/db";
import { parseConfig } from "@peggy/config";
import type { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, sql, asc, desc } from "drizzle-orm";
import { documents, documentVersions, documentLocales, locales } from "@peggy/db";

function getDb() {
  const config = parseConfig();
  const client = createDbClient(config.DATABASE_URL);
  return client.db as ReturnType<typeof drizzle>;
}

export interface QueryOptions {
  locale?: string;
  filters?: Record<string, unknown>;
  sort?: string;
  page?: number;
  pageSize?: number;
}

async function defaultLocale(db: ReturnType<typeof drizzle>): Promise<string> {
  const rows = await db.select().from(locales).where(eq(locales.isDefault, true));
  return rows[0]?.code ?? "en";
}

function buildFilterClause(filters: Record<string, unknown> | undefined): ReturnType<typeof sql> | null {
  if (!filters) return null;
  const clauses: unknown[] = [];
  for (const [field, raw] of Object.entries(filters)) {
    const opObj = (typeof raw === "object" && raw !== null && !Array.isArray(raw)) ? (raw as Record<string, unknown>) : { $eq: raw };
    for (const [op, val] of Object.entries(opObj)) {
      const col = sql`${documentVersions.data}->>${field}`;
      switch (op) {
        case "$eq":
          clauses.push(sql`${col} = ${String(val)}`);
          break;
        case "$ne":
          clauses.push(sql`${col} <> ${String(val)}`);
          break;
        case "$gt":
          clauses.push(sql`(${col})::numeric > ${Number(val)}`);
          break;
        case "$lt":
          clauses.push(sql`(${col})::numeric < ${Number(val)}`);
          break;
        case "$contains":
          clauses.push(sql`${col} ILIKE ${"%" + String(val) + "%"}`);
          break;
        case "$in":
          if (Array.isArray(val)) {
            const inList = val.map((v) => sql`${String(v)}`).reduce((a, b) => sql`${a}, ${b}`);
            clauses.push(sql`${col} IN (${inList})`);
          }
          break;
        default:
          clauses.push(sql`${col} = ${String(val)}`);
      }
    }
  }
  if (clauses.length === 0) return null;
  return clauses.reduce((a, b) => sql`${a} AND ${b}`) as ReturnType<typeof sql>;
}

export async function queryPublished(contentTypeId: string, opts: QueryOptions = {}) {
  const db = getDb();
  const locale = opts.locale ?? (await defaultLocale(db));
  const page = opts.page ?? 1;
  const pageSize = Math.min(opts.pageSize ?? 25, 100);
  const offset = (page - 1) * pageSize;

  const filterClause = buildFilterClause(opts.filters as Record<string, unknown> | undefined);

  const baseWhere = and(
    eq(documents.contentTypeId, contentTypeId),
    sql`${documents.deletedAt} IS NULL`,
    sql`${documentLocales.publishedVersionId} IS NOT NULL`,
    eq(documentLocales.locale, locale),
    filterClause ?? sql`TRUE`,
  );

  const countResult = await db.select({ count: sql<number>`count(*)` })
    .from(documents)
    .innerJoin(documentLocales, eq(documents.id, documentLocales.documentId))
    .innerJoin(documentVersions, eq(documentLocales.publishedVersionId, documentVersions.id))
    .where(baseWhere);
  const total = Number(countResult[0]?.count ?? 0);

  let query = db.select({
    documentId: documents.documentId,
    data: documentVersions.data,
    slug: documentVersions.slug,
    publishedAt: documentLocales.publishedAt,
    createdAt: documentVersions.createdAt,
  })
    .from(documents)
    .innerJoin(documentLocales, eq(documents.id, documentLocales.documentId))
    .innerJoin(documentVersions, eq(documentLocales.publishedVersionId, documentVersions.id))
    .where(baseWhere);

  // Sorting
  if (opts.sort) {
    const [field, dir] = opts.sort.split(":");
    const direction = dir === "desc" ? "desc" : "asc";
    const orderFn = direction === "desc" ? desc : asc;
    if (field === "createdAt") query = query.orderBy(orderFn(documentVersions.createdAt)) as typeof query;
    else if (field === "publishedAt") query = query.orderBy(orderFn(documentLocales.publishedAt)) as typeof query;
    else if (field === "slug") query = query.orderBy(orderFn(documentVersions.slug)) as typeof query;
    else query = query.orderBy(orderFn(sql`${documentVersions.data}->>${field}`)) as typeof query;
  }

  const rows = await query.limit(pageSize).offset(offset);

  return {
    data: rows,
    meta: {
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    },
  };
}

export async function getPublishedBySlug(contentTypeId: string, slug: string, locale?: string) {
  const db = getDb();
  const loc = locale ?? (await defaultLocale(db));
  const rows = await db.select({
    documentId: documents.documentId,
    data: documentVersions.data,
    slug: documentVersions.slug,
    publishedAt: documentLocales.publishedAt,
  })
    .from(documents)
    .innerJoin(documentLocales, eq(documents.id, documentLocales.documentId))
    .innerJoin(documentVersions, eq(documentLocales.publishedVersionId, documentVersions.id))
    .where(and(
      eq(documents.contentTypeId, contentTypeId),
      eq(documentVersions.slug, slug),
      eq(documentLocales.locale, loc),
      sql`${documents.deletedAt} IS NULL`,
      sql`${documentLocales.publishedVersionId} IS NOT NULL`,
    ));
  return rows[0] ?? null;
}
