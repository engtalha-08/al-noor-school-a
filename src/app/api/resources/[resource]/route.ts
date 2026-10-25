import { db } from "@/db";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { getResource, coerceBody, validate } from "@/lib/resources.server";
import { requireCap, audit, errorResponse, HttpError } from "@/lib/auth";

type Cols = Record<string, never>;
const col = (table: unknown, name: string) => (table as unknown as Cols)[name as never];

const UNIQUE: Record<string, string> = { students: "admissionNo", staff: "employeeId", admissions: "applicationNo" };

export async function GET(req: Request, ctx: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await ctx.params;
    const r = getResource(resource);
    if (!r) throw new HttpError(404, "Unknown resource");
    await requireCap(r.def.readCap);

    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const pageSize = Math.min(100, Number(url.searchParams.get("pageSize") ?? 20));
    const sort = url.searchParams.get("sort") ?? r.def.defaultSort ?? "id";
    const dir = url.searchParams.get("dir") === "asc" ? "asc" : "desc";

    const conditions: SQL[] = [];
    if (q && r.def.searchFields.length) {
      const parts = r.def.searchFields
        .map((fname) => col(r.table, fname))
        .filter(Boolean)
        .map((c) => ilike(sql`${c}::text`, `%${q}%`));
      const combined = or(...parts);
      if (combined) conditions.push(combined);
    }
    for (const field of r.def.fields) {
      const val = url.searchParams.get(field.name);
      if (val != null && val !== "") {
        const c = col(r.table, field.name);
        if (!c) continue;
        conditions.push(eq(c, field.type === "ref" || field.type === "number" ? Number(val) : val));
      }
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const sortCol = col(r.table, sort) ?? col(r.table, "id");
    const rows = await db
      .select()
      .from(r.table)
      .where(where)
      .orderBy(dir === "asc" ? asc(sortCol) : desc(sortCol))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [{ value: total }] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(r.table)
      .where(where);

    return Response.json({ rows, total, page, pageSize });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await ctx.params;
    const r = getResource(resource);
    if (!r) throw new HttpError(404, "Unknown resource");
    const user = await requireCap(r.def.writeCap);

    const body = (await req.json()) as Record<string, unknown>;
    const errors = validate(r.def, body);
    if (errors.length) throw new HttpError(422, errors.join(", "));

    const values = coerceBody(r.def, body);

    const uniqueField = UNIQUE[resource];
    if (uniqueField && values[uniqueField]) {
      const existing = await db
        .select()
        .from(r.table)
        .where(eq(col(r.table, uniqueField), values[uniqueField]))
        .limit(1);
      if (existing.length) throw new HttpError(409, `A record with this ${uniqueField} already exists`);
    }

    const [row] = await db.insert(r.table).values(values).returning();
    await audit(user, "create", resource, (row as { id?: number }).id, JSON.stringify(values).slice(0, 500));
    return Response.json({ row }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
