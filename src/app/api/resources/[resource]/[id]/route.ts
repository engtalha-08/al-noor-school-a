import { db } from "@/db";
import { eq } from "drizzle-orm";
import { getResource, coerceBody, validate } from "@/lib/resources.server";
import { requireCap, audit, errorResponse, HttpError } from "@/lib/auth";

type Cols = Record<string, never>;
const col = (table: unknown, name: string) => (table as unknown as Cols)[name as never];

export async function GET(_req: Request, ctx: { params: Promise<{ resource: string; id: string }> }) {
  try {
    const { resource, id } = await ctx.params;
    const r = getResource(resource);
    if (!r) throw new HttpError(404, "Unknown resource");
    await requireCap(r.def.readCap);
    const [row] = await db.select().from(r.table).where(eq(col(r.table, "id"), Number(id)));
    if (!row) throw new HttpError(404, "Record not found");
    return Response.json({ row });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ resource: string; id: string }> }) {
  try {
    const { resource, id } = await ctx.params;
    const r = getResource(resource);
    if (!r) throw new HttpError(404, "Unknown resource");
    const user = await requireCap(r.def.writeCap);

    const body = (await req.json()) as Record<string, unknown>;
    const errors = validate(r.def, body, true);
    if (errors.length) throw new HttpError(422, errors.join(", "));

    const values = coerceBody(r.def, body);
    if (!Object.keys(values).length) throw new HttpError(422, "No valid fields supplied");

    const [row] = await db.update(r.table).set(values).where(eq(col(r.table, "id"), Number(id))).returning();
    if (!row) throw new HttpError(404, "Record not found");
    await audit(user, "update", resource, id, JSON.stringify(values).slice(0, 500));
    return Response.json({ row });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ resource: string; id: string }> }) {
  try {
    const { resource, id } = await ctx.params;
    const r = getResource(resource);
    if (!r) throw new HttpError(404, "Unknown resource");
    const user = await requireCap(r.def.writeCap);
    if (resource === "payroll" || resource === "feeStructures") {
      // financial records: principal/accountant already enforced by cap
    }
    const [row] = await db.delete(r.table).where(eq(col(r.table, "id"), Number(id))).returning();
    if (!row) throw new HttpError(404, "Record not found");
    await audit(user, "delete", resource, id);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
