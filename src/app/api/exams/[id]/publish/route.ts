import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import { exams, results } from "@/db/schema";
import { requireCap, audit, errorResponse, HttpError } from "@/lib/auth";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCap("exams.publish");
    const { id } = await ctx.params;
    const examId = Number(id);
    const [exam] = await db.select().from(exams).where(eq(exams.id, examId));
    if (!exam) throw new HttpError(404, "Exam not found");
    if (exam.status === "published") throw new HttpError(409, "These results are already published");

    const [{ v: count }] = await db
      .select({ v: sql<number>`count(*)::int` })
      .from(results)
      .where(eq(results.examId, examId));
    if (!count) throw new HttpError(422, "No marks have been entered for this exam yet");

    await db.update(exams).set({ status: "published", publishedAt: new Date() }).where(eq(exams.id, examId));
    await audit(user, "results_publish", "exams", examId, `${count} result rows published`);
    return Response.json({ ok: true, published: count });
  } catch (e) {
    return errorResponse(e);
  }
}
