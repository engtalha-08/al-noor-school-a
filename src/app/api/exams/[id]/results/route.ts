import { db } from "@/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { exams, examSubjects, results, students, subjects } from "@/db/schema";
import { requireCap, audit, errorResponse, HttpError } from "@/lib/auth";
import { gradeFor } from "@/lib/grading";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireCap("exams.read");
    const { id } = await ctx.params;
    const examId = Number(id);
    const [exam] = await db.select().from(exams).where(eq(exams.id, examId));
    if (!exam) throw new HttpError(404, "Exam not found");

    const papers = await db
      .select({
        id: examSubjects.id,
        subjectId: examSubjects.subjectId,
        subjectName: subjects.name,
        examDate: examSubjects.examDate,
        maxMarks: examSubjects.maxMarks,
        passMarks: examSubjects.passMarks,
      })
      .from(examSubjects)
      .leftJoin(subjects, eq(subjects.id, examSubjects.subjectId))
      .where(eq(examSubjects.examId, examId));

    const roster = exam.classId
      ? await db
          .select()
          .from(students)
          .where(and(eq(students.classId, exam.classId), eq(students.status, "active")))
          .orderBy(asc(students.fullName))
      : [];

    const marks = await db.select().from(results).where(eq(results.examId, examId));
    return Response.json({ exam, papers, roster, marks });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCap("exams.write");
    const { id } = await ctx.params;
    const examId = Number(id);
    const [exam] = await db.select().from(exams).where(eq(exams.id, examId));
    if (!exam) throw new HttpError(404, "Exam not found");
    if (exam.status === "published" && user.role !== "principal") {
      throw new HttpError(403, "Results are published. Only the Principal may record an authorised correction.");
    }

    const body = (await req.json()) as {
      entries: { examSubjectId: number; studentId: number; marks: number }[];
    };
    if (!body.entries?.length) throw new HttpError(422, "No marks supplied");

    const paperIds = [...new Set(body.entries.map((e) => e.examSubjectId))];
    const papers = await db.select().from(examSubjects).where(inArray(examSubjects.id, paperIds));
    const paperMap = new Map(papers.map((p) => [p.id, p]));

    const rows = body.entries.map((e) => {
      const paper = paperMap.get(e.examSubjectId);
      if (!paper) throw new HttpError(422, "Invalid exam subject");
      if (e.marks < 0 || e.marks > paper.maxMarks) {
        throw new HttpError(422, `Marks must be between 0 and ${paper.maxMarks}`);
      }
      const pct = (e.marks / paper.maxMarks) * 100;
      const g = gradeFor(pct);
      return {
        examId,
        examSubjectId: e.examSubjectId,
        studentId: e.studentId,
        marksObtained: String(e.marks),
        grade: g.grade,
        remarks: g.remarks,
        enteredBy: user.id,
      };
    });

    await db
      .insert(results)
      .values(rows)
      .onConflictDoUpdate({
        target: [results.examSubjectId, results.studentId],
        set: {
          marksObtained: sql`excluded.marks_obtained`,
          grade: sql`excluded.grade`,
          remarks: sql`excluded.remarks`,
          enteredBy: sql`excluded.entered_by`,
          updatedAt: new Date(),
        },
      });

    await audit(user, exam.status === "published" ? "result_correction" : "marks_entry", "results", examId, `${rows.length} entries`);
    return Response.json({ ok: true, saved: rows.length });
  } catch (e) {
    return errorResponse(e);
  }
}
