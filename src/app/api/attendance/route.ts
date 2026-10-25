import { db } from "@/db";
import { and, eq, inArray, sql, asc, gte, lte } from "drizzle-orm";
import { students, attendance, classes, sections } from "@/db/schema";
import { requireCap, audit, errorResponse, HttpError } from "@/lib/auth";

/** GET roster + existing attendance for a class/section/date */
export async function GET(req: Request) {
  try {
    await requireCap("attendance.read");
    const url = new URL(req.url);
    const classId = Number(url.searchParams.get("classId"));
    const sectionId = url.searchParams.get("sectionId");
    const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const session = url.searchParams.get("session") ?? "full-day";
    if (!classId) throw new HttpError(422, "classId is required");

    const roster = await db
      .select()
      .from(students)
      .where(
        and(
          eq(students.classId, classId),
          eq(students.status, "active"),
          sectionId ? eq(students.sectionId, Number(sectionId)) : undefined,
        ),
      )
      .orderBy(asc(students.fullName));

    const ids = roster.map((s) => s.id);
    const existing = ids.length
      ? await db
          .select()
          .from(attendance)
          .where(and(inArray(attendance.studentId, ids), eq(attendance.date, date), eq(attendance.session, session)))
      : [];

    return Response.json({ roster, existing, date, session });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST bulk attendance — upsert, prevents duplicate rows for same student/date/session */
export async function POST(req: Request) {
  try {
    const user = await requireCap("attendance.write");
    const body = (await req.json()) as {
      classId: number;
      sectionId?: number | null;
      date: string;
      session?: string;
      entries: { studentId: number; status: string; remarks?: string }[];
    };
    if (!body.date || !Array.isArray(body.entries) || !body.entries.length) {
      throw new HttpError(422, "Date and at least one attendance entry are required");
    }
    const valid = ["present", "absent", "late", "leave"];
    for (const e of body.entries) {
      if (!valid.includes(e.status)) throw new HttpError(422, `Invalid attendance status: ${e.status}`);
    }
    const session = body.session ?? "full-day";

    const rows = body.entries.map((e) => ({
      studentId: e.studentId,
      classId: body.classId,
      sectionId: body.sectionId ?? null,
      date: body.date,
      session,
      status: e.status,
      remarks: e.remarks ?? null,
      markedBy: user.id,
    }));

    await db
      .insert(attendance)
      .values(rows)
      .onConflictDoUpdate({
        target: [attendance.studentId, attendance.date, attendance.session],
        set: {
          status: sql`excluded.status`,
          remarks: sql`excluded.remarks`,
          markedBy: sql`excluded.marked_by`,
        },
      });

    await audit(user, "attendance_submit", "attendance", `${body.classId}-${body.date}`, `${rows.length} records`);
    const absentees = rows.filter((r) => r.status === "absent").length;
    return Response.json({ ok: true, saved: rows.length, absentees });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Report endpoint used by reports page */
export async function PUT(req: Request) {
  try {
    await requireCap("attendance.read");
    const { from, to } = (await req.json()) as { from: string; to: string };
    const rows = await db
      .select({
        className: classes.name,
        section: sections.name,
        present: sql<number>`sum(case when ${attendance.status}='present' then 1 else 0 end)::int`,
        absent: sql<number>`sum(case when ${attendance.status}='absent' then 1 else 0 end)::int`,
        late: sql<number>`sum(case when ${attendance.status}='late' then 1 else 0 end)::int`,
        leave: sql<number>`sum(case when ${attendance.status}='leave' then 1 else 0 end)::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(attendance)
      .leftJoin(classes, eq(classes.id, attendance.classId))
      .leftJoin(sections, eq(sections.id, attendance.sectionId))
      .where(and(gte(attendance.date, from), lte(attendance.date, to)))
      .groupBy(classes.name, sections.name);
    return Response.json({ rows });
  } catch (e) {
    return errorResponse(e);
  }
}
