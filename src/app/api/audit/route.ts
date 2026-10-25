import { db } from "@/db";
import { desc, ilike, or } from "drizzle-orm";
import { auditLogs } from "@/db/schema";
import { requireCap, errorResponse } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    await requireCap("audit.read");
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const rows = await db
      .select()
      .from(auditLogs)
      .where(q ? or(ilike(auditLogs.action, `%${q}%`), ilike(auditLogs.entity, `%${q}%`), ilike(auditLogs.userName, `%${q}%`)) : undefined)
      .orderBy(desc(auditLogs.id))
      .limit(50)
      .offset((page - 1) * 50);
    return Response.json({ rows, page });
  } catch (e) {
    return errorResponse(e);
  }
}
