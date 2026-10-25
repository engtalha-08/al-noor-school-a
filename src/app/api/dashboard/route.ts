import { db } from "@/db";
import { and, desc, eq, gte, sql, asc } from "drizzle-orm";
import {
  students,
  staff,
  attendance,
  invoices,
  payments,
  expenses,
  admissions,
  leaveRequests,
  exams,
  events,
  announcements,
  auditLogs,
  classes,
  results,
  timetable,
  homework,
  teacherAssignments,
  subjects,
  books,
  bookLoans,
  complaints,
} from "@/db/schema";
import { requireUser, errorResponse } from "@/lib/auth";

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => new Date().toISOString().slice(0, 7) + "-01";
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

export async function GET() {
  try {
    const user = await requireUser();
    const role = user.role;

    const num = (v: unknown) => Number(v ?? 0);

    const [studentCount] = await db
      .select({ v: sql<number>`count(*)::int` })
      .from(students)
      .where(eq(students.status, "active"));
    const [staffCount] = await db.select({ v: sql<number>`count(*)::int` }).from(staff);
    const [teacherCount] = await db
      .select({ v: sql<number>`count(*)::int` })
      .from(staff)
      .where(sql`${staff.designation} ILIKE '%teacher%'`);

    const todayAtt = await db
      .select({ status: attendance.status, v: sql<number>`count(*)::int` })
      .from(attendance)
      .where(eq(attendance.date, today()))
      .groupBy(attendance.status);
    const present = todayAtt.find((a) => a.status === "present")?.v ?? 0;
    const absent = todayAtt.find((a) => a.status === "absent")?.v ?? 0;
    const late = todayAtt.find((a) => a.status === "late")?.v ?? 0;
    const markedToday = todayAtt.reduce((s, a) => s + a.v, 0);

    const attendanceTrend = await db
      .select({
        date: attendance.date,
        present: sql<number>`sum(case when ${attendance.status} in ('present','late') then 1 else 0 end)::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(attendance)
      .where(gte(attendance.date, daysAgo(13)))
      .groupBy(attendance.date)
      .orderBy(asc(attendance.date));

    const [collectedMonth] = await db
      .select({ v: sql<string>`coalesce(sum(${payments.amount}),0)` })
      .from(payments)
      .where(and(gte(payments.paidOn, monthStart()), eq(payments.voided, false)));

    const [billed] = await db
      .select({ v: sql<string>`coalesce(sum(${invoices.amount} - ${invoices.discount} + ${invoices.lateFee}),0)` })
      .from(invoices)
      .where(sql`${invoices.status} <> 'cancelled'`);
    const [collectedAll] = await db
      .select({ v: sql<string>`coalesce(sum(${payments.amount}),0)` })
      .from(payments)
      .where(eq(payments.voided, false));

    const feeTrend = await db
      .select({
        month: sql<string>`to_char(${payments.paidOn}, 'YYYY-MM')`,
        amount: sql<string>`coalesce(sum(${payments.amount}),0)`,
      })
      .from(payments)
      .where(eq(payments.voided, false))
      .groupBy(sql`to_char(${payments.paidOn}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${payments.paidOn}, 'YYYY-MM')`);

    const expenseTrend = await db
      .select({
        month: sql<string>`to_char(${expenses.spentOn}, 'YYYY-MM')`,
        amount: sql<string>`coalesce(sum(${expenses.amount}),0)`,
      })
      .from(expenses)
      .groupBy(sql`to_char(${expenses.spentOn}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${expenses.spentOn}, 'YYYY-MM')`);

    const [expensesMonth] = await db
      .select({ v: sql<string>`coalesce(sum(${expenses.amount}),0)` })
      .from(expenses)
      .where(gte(expenses.spentOn, monthStart()));

    const [newAdmissions] = await db
      .select({ v: sql<number>`count(*)::int` })
      .from(students)
      .where(gte(students.admissionDate, monthStart()));

    const [pendingLeaves] = await db
      .select({ v: sql<number>`count(*)::int` })
      .from(leaveRequests)
      .where(eq(leaveRequests.status, "pending"));

    const [pendingAdmissions] = await db
      .select({ v: sql<number>`count(*)::int` })
      .from(admissions)
      .where(sql`${admissions.status} in ('submitted','documents_reviewed')`);

    const [openComplaints] = await db
      .select({ v: sql<number>`count(*)::int` })
      .from(complaints)
      .where(sql`${complaints.status} in ('open','investigating')`);

    const enrollmentByClass = await db
      .select({ label: classes.name, value: sql<number>`count(${students.id})::int` })
      .from(classes)
      .leftJoin(students, and(eq(students.classId, classes.id), eq(students.status, "active")))
      .groupBy(classes.id, classes.name, classes.level)
      .orderBy(asc(classes.level));

    const upcomingExams = await db
      .select()
      .from(exams)
      .where(sql`${exams.startDate} >= ${today()}`)
      .orderBy(asc(exams.startDate))
      .limit(5);

    const upcomingEvents = await db
      .select()
      .from(events)
      .where(sql`${events.startDate} >= ${today()}`)
      .orderBy(asc(events.startDate))
      .limit(6);

    const recentAnnouncements = await db
      .select()
      .from(announcements)
      .orderBy(desc(announcements.id))
      .limit(5);

    const recentActivity = await db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(8);

    const recentResults = await db
      .select({
        exam: exams.name,
        avg: sql<string>`round(avg(${results.marksObtained}), 1)`,
        count: sql<number>`count(*)::int`,
      })
      .from(results)
      .innerJoin(exams, eq(exams.id, results.examId))
      .groupBy(exams.name)
      .limit(5);

    const [booksOut] = await db
      .select({ v: sql<number>`count(*)::int` })
      .from(bookLoans)
      .where(eq(bookLoans.status, "issued"));
    const [bookCount] = await db.select({ v: sql<number>`count(*)::int` }).from(books);

    let teacherData: unknown = null;
    if (role === "teacher") {
      const [me] = await db.select().from(staff).where(eq(staff.userId, user.id));
      if (me) {
        const dow = new Date().getDay() === 0 ? 7 : new Date().getDay();
        const periods = await db
          .select({
            period: timetable.period,
            start: timetable.startTime,
            end: timetable.endTime,
            room: timetable.room,
            className: classes.name,
            subject: subjects.name,
          })
          .from(timetable)
          .leftJoin(classes, eq(classes.id, timetable.classId))
          .leftJoin(subjects, eq(subjects.id, timetable.subjectId))
          .where(and(eq(timetable.staffId, me.id), eq(timetable.dayOfWeek, dow)))
          .orderBy(asc(timetable.period));
        const assigned = await db
          .select({ className: classes.name, subject: subjects.name })
          .from(teacherAssignments)
          .leftJoin(classes, eq(classes.id, teacherAssignments.classId))
          .leftJoin(subjects, eq(subjects.id, teacherAssignments.subjectId))
          .where(eq(teacherAssignments.staffId, me.id));
        const hw = await db.select().from(homework).where(eq(homework.staffId, me.id)).orderBy(desc(homework.id)).limit(5);
        teacherData = { staff: me, periods, assigned, homework: hw };
      }
    }

    return Response.json({
      role,
      stats: {
        students: studentCount.v,
        staff: staffCount.v,
        teachers: teacherCount.v,
        present,
        absent,
        late,
        markedToday,
        attendancePct: markedToday ? Math.round(((present + late) / markedToday) * 100) : 0,
        collectedMonth: num(collectedMonth.v),
        collectedAll: num(collectedAll.v),
        billed: num(billed.v),
        outstanding: Math.max(0, num(billed.v) - num(collectedAll.v)),
        expensesMonth: num(expensesMonth.v),
        newAdmissions: newAdmissions.v,
        pendingLeaves: pendingLeaves.v,
        pendingAdmissions: pendingAdmissions.v,
        openComplaints: openComplaints.v,
        booksOut: booksOut.v,
        books: bookCount.v,
      },
      charts: {
        attendanceTrend: attendanceTrend.map((a) => ({
          date: a.date,
          pct: a.total ? Math.round((a.present / a.total) * 100) : 0,
        })),
        feeTrend: feeTrend.map((f) => ({ month: f.month, collected: Number(f.amount) })),
        expenseTrend: expenseTrend.map((f) => ({ month: f.month, spent: Number(f.amount) })),
        enrollmentByClass,
      },
      upcomingExams,
      upcomingEvents,
      recentAnnouncements,
      recentActivity,
      recentResults,
      teacherData,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
