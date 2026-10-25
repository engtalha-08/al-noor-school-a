import { db } from "@/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  students,
  guardians,
  studentGuardians,
  attendance,
  timetable,
  classes,
  sections,
  subjects,
  staff,
  homework,
  exams,
  examSubjects,
  results,
  invoices,
  payments,
  announcements,
  events,
  notifications,
} from "@/db/schema";
import { requireUser, errorResponse, HttpError } from "@/lib/auth";

async function childrenFor(userId: number) {
  const [g] = await db.select().from(guardians).where(eq(guardians.userId, userId));
  if (!g) return { guardian: null, kids: [] as { id: number; fullName: string; admissionNo: string }[] };
  const kids = await db
    .select({ id: students.id, fullName: students.fullName, admissionNo: students.admissionNo, classId: students.classId })
    .from(studentGuardians)
    .innerJoin(students, eq(students.id, studentGuardians.studentId))
    .where(and(eq(studentGuardians.guardianId, g.id), eq(studentGuardians.verified, true)));
  return { guardian: g, kids };
}

async function studentPayload(studentId: number, includeFees: boolean) {
  const [student] = await db.select().from(students).where(eq(students.id, studentId));
  if (!student) throw new HttpError(404, "Student record not found");

  const [cls] = student.classId ? await db.select().from(classes).where(eq(classes.id, student.classId)) : [];
  const [sec] = student.sectionId ? await db.select().from(sections).where(eq(sections.id, student.sectionId)) : [];

  const attRows = await db
    .select({ status: attendance.status, v: sql<number>`count(*)::int` })
    .from(attendance)
    .where(eq(attendance.studentId, studentId))
    .groupBy(attendance.status);
  const recentAttendance = await db
    .select()
    .from(attendance)
    .where(eq(attendance.studentId, studentId))
    .orderBy(desc(attendance.date))
    .limit(20);

  const tt = student.classId
    ? await db
        .select({
          dayOfWeek: timetable.dayOfWeek,
          period: timetable.period,
          startTime: timetable.startTime,
          endTime: timetable.endTime,
          room: timetable.room,
          subject: subjects.name,
          teacher: staff.fullName,
        })
        .from(timetable)
        .leftJoin(subjects, eq(subjects.id, timetable.subjectId))
        .leftJoin(staff, eq(staff.id, timetable.staffId))
        .where(eq(timetable.classId, student.classId))
        .orderBy(asc(timetable.dayOfWeek), asc(timetable.period))
    : [];

  const hw = student.classId
    ? await db
        .select({
          id: homework.id,
          title: homework.title,
          dueDate: homework.dueDate,
          instructions: homework.instructions,
          subject: subjects.name,
        })
        .from(homework)
        .leftJoin(subjects, eq(subjects.id, homework.subjectId))
        .where(eq(homework.classId, student.classId))
        .orderBy(desc(homework.dueDate))
        .limit(15)
    : [];

  const upcomingExams = student.classId
    ? await db
        .select()
        .from(exams)
        .where(and(eq(exams.classId, student.classId), sql`${exams.status} <> 'published'`))
        .orderBy(asc(exams.startDate))
        .limit(5)
    : [];

  const publishedExams = await db.select().from(exams).where(eq(exams.status, "published"));
  const publishedIds = publishedExams.map((e) => e.id);
  const marks = publishedIds.length
    ? await db
        .select({
          examId: results.examId,
          exam: exams.name,
          subject: subjects.name,
          marks: results.marksObtained,
          max: examSubjects.maxMarks,
          grade: results.grade,
        })
        .from(results)
        .innerJoin(exams, eq(exams.id, results.examId))
        .innerJoin(examSubjects, eq(examSubjects.id, results.examSubjectId))
        .leftJoin(subjects, eq(subjects.id, examSubjects.subjectId))
        .where(and(eq(results.studentId, studentId), inArray(results.examId, publishedIds)))
    : [];

  let fees = null;
  if (includeFees) {
    const invs = await db.select().from(invoices).where(eq(invoices.studentId, studentId)).orderBy(desc(invoices.id));
    const pays = await db.select().from(payments).where(eq(payments.studentId, studentId)).orderBy(desc(payments.id));
    const payable = invs
      .filter((i) => i.status !== "cancelled")
      .reduce((s, i) => s + Number(i.amount) - Number(i.discount) + Number(i.lateFee), 0);
    const paid = pays.filter((p) => !p.voided).reduce((s, p) => s + Number(p.amount), 0);
    fees = { invoices: invs, payments: pays, payable, paid, outstanding: payable - paid };
  }

  const present = attRows.find((a) => a.status === "present")?.v ?? 0;
  const lateCount = attRows.find((a) => a.status === "late")?.v ?? 0;
  const total = attRows.reduce((s, a) => s + a.v, 0);

  return {
    student: { ...student, className: cls?.name ?? null, sectionName: sec?.name ?? null },
    attendance: {
      summary: Object.fromEntries(attRows.map((a) => [a.status, a.v])),
      percentage: total ? Math.round(((present + lateCount) / total) * 100) : 0,
      total,
      recent: recentAttendance,
    },
    timetable: tt,
    homework: hw,
    upcomingExams,
    results: marks,
    fees,
  };
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const common = {
      announcements: await db.select().from(announcements).where(eq(announcements.status, "sent")).orderBy(desc(announcements.id)).limit(8),
      events: await db
        .select()
        .from(events)
        .where(sql`${events.startDate} >= current_date - 7`)
        .orderBy(asc(events.startDate))
        .limit(10),
      notifications: await db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.id)).limit(15),
    };

    if (user.role === "student") {
      const [me] = await db.select().from(students).where(eq(students.userId, user.id));
      if (!me) throw new HttpError(404, "No student record is linked to your account. Please contact the school office.");
      return Response.json({ mode: "student", ...common, data: await studentPayload(me.id, false) });
    }

    if (user.role === "parent") {
      const { guardian, kids } = await childrenFor(user.id);
      if (!guardian) throw new HttpError(404, "No guardian record is linked to your account. Please contact the school office.");
      if (!kids.length) return Response.json({ mode: "parent", guardian, kids: [], data: null, ...common });
      const requested = Number(url.searchParams.get("studentId") ?? kids[0].id);
      // Relationship validation — a parent may only read their own linked children.
      if (!kids.some((k) => k.id === requested)) throw new HttpError(403, "You are not authorised to view this student's record");
      return Response.json({ mode: "parent", guardian, kids, ...common, data: await studentPayload(requested, true) });
    }

    throw new HttpError(403, "This portal is available to students and parents only");
  } catch (e) {
    return errorResponse(e);
  }
}
