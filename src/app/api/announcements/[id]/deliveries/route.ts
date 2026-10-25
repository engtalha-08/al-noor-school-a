import { db } from "@/db";
import { eq } from "drizzle-orm";
import { messageDeliveries } from "@/db/schema";
import { requireCap, errorResponse } from "@/lib/auth";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireCap("announcements.read");
    const { id } = await ctx.params;
    const rows = await db
      .select()
      .from(messageDeliveries)
      .where(eq(messageDeliveries.announcementId, Number(id)))
      .limit(500);
    return Response.json({ rows });
  } catch (e) {
    return errorResponse(e);
  }
}
