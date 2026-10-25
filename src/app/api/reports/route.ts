import { db } from "@/db";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import {
  students,
  classes,
  sections,
  attendance,
  invoices,
  payments,
  expenses,
  payroll,
  staff,
  teacherAssignments,
  books,
  bookLoans,
  routes,
  transportAssignments,
  inventoryItems,
  results,
  exams,
  subjects,
} from "@/db/schema";
import { requireCap, errorResponse, HttpError } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") ?? "enrollment";
    const from = url.searchParams.get("from") ?? "2000-01-01";
    const to = url.searchParams.get("to") ?? "2100-01-01";

    const financial = ["feeCollection", "outstanding", "expenses", "payroll"];
    await requireCap(financial.includes(type) ? "fees.read" : "reports.read");

    switch (type) {
      case "enrollment": {
        const rows = await db
          .select({
            Class: classes.name,
            Section: sections.name,
            Students: sql<number>`count(${students.id})::int`,
            Male: sql<number>`sum(case when ${students.gender}='Male' then 1 else 0 end)::int`,
            Female: sql<number>`sum(case when ${students.gender}='Female' then 1 else 0 end)::int`,
          })
          .from(classes)
          .leftJoin(students, and(eq(students.classId, classes.id), eq(students.status, "active")))
          .leftJoin(sections, eq(sections.id, students.sectionId))
          .groupBy(classes.name, sections.name, classes.level)
          .orderBy(classes.level);
        return Response.json({ rows });
      }
      case "attendance": {
        const rows = await db
          .select({
            Class: classes.name,
            Present: sql<number>`sum(case when ${attendance.status}='present' then 1 else 0 end)::int`,
            Absent: sql<number>`sum(case when ${attendance.status}='absent' then 1 else 0 end)::int`,
            Late: sql<number>`sum(case when ${attendance.status}='late' then 1 else 0 end)::int`,
            Leave: sql<number>`sum(case when ${attendance.status}='leave' then 1 else 0 end)::int`,
            Records: sql<number>`count(*)::int`,
          })
          .from(attendance)
          .leftJoin(classes, eq(classes.id, attendance.classId))
          .where(and(gte(attendance.date, from), lte(attendance.date, to)))
          .groupBy(classes.name);
        return Response.json({ rows });
      }
      case "feeCollection": {
        const rows = await db
          .select({
            Month: sql<string>`to_char(${payments.paidOn},'YYYY-MM')`,
            Receipts: sql<number>`count(*)::int`,
            Collected: sql<string>`sum(${payments.amount})`,
          })
          .from(payments)
          .where(and(eq(payments.voided, false), gte(payments.paidOn, from), lte(payments.paidOn, to)))
          .groupBy(sql`to_char(${payments.paidOn},'YYYY-MM')`)
          .orderBy(sql`to_char(${payments.paidOn},'YYYY-MM')`);
        return Response.json({ rows });
      }
      case "outstanding": {
        const rows = await db
          .select({
            Student: students.fullName,
            AdmissionNo: students.admissionNo,
            Class: classes.name,
            Invoices: sql<number>`count(${invoices.id})::int`,
            Billed: sql<string>`coalesce(sum(${invoices.amount} - ${invoices.discount} + ${invoices.lateFee}),0)`,
            Paid: sql<string>`coalesce(sum((select coalesce(sum(p.amount),0) from payments p where p.invoice_id=${invoices.id} and p.voided=false)),0)`,
            Outstanding: sql<string>`coalesce(sum(${invoices.amount} - ${invoices.discount} + ${invoices.lateFee}),0) - coalesce(sum((select coalesce(sum(p.amount),0) from payments p where p.invoice_id=${invoices.id} and p.voided=false)),0)`,
          })
          .from(invoices)
          .innerJoin(students, eq(students.id, invoices.studentId))
          .leftJoin(classes, eq(classes.id, students.classId))
          .where(sql`${invoices.status} in ('unpaid','partial')`)
          .groupBy(students.fullName, students.admissionNo, classes.name)
          .orderBy(sql`7 desc`);
        return Response.json({ rows });
      }
      case "expenses": {
        const rows = await db
          .select({
            Category: expenses.category,
            Items: sql<number>`count(*)::int`,
            Total: sql<string>`sum(${expenses.amount})`,
            Approved: sql<string>`sum(case when ${expenses.status}='approved' then ${expenses.amount} else 0 end)`,
          })
          .from(expenses)
          .where(and(gte(expenses.spentOn, from), lte(expenses.spentOn, to)))
          .groupBy(expenses.category);
        return Response.json({ rows });
      }
      case "payroll": {
        await requireCap("payroll.read");
        const rows = await db
          .select({
            Period: payroll.period,
            Employees: sql<number>`count(*)::int`,
            Basic: sql<string>`sum(${payroll.basic})`,
            Allowances: sql<string>`sum(${payroll.allowances})`,
            Deductions: sql<string>`sum(${payroll.deductions})`,
            NetPay: sql<string>`sum(${payroll.netPay})`,
          })
          .from(payroll)
          .groupBy(payroll.period)
          .orderBy(payroll.period);
        return Response.json({ rows });
      }
      case "teacherWorkload": {
        const rows = await db
          .select({
            Teacher: staff.fullName,
            Designation: staff.designation,
            Assignments: sql<number>`count(${teacherAssignments.id})::int`,
          })
          .from(staff)
          .leftJoin(teacherAssignments, eq(teacherAssignments.staffId, staff.id))
          .groupBy(staff.fullName, staff.designation)
          .orderBy(sql`3 desc`);
        return Response.json({ rows });
      }
      case "academic": {
        const rows = await db
          .select({
            Exam: exams.name,
            Subject: subjects.name,
            Students: sql<number>`count(*)::int`,
            Average: sql<string>`round(avg(${results.marksObtained}),2)`,
            Highest: sql<string>`max(${results.marksObtained})`,
            Lowest: sql<string>`min(${results.marksObtained})`,
          })
          .from(results)
          .innerJoin(exams, eq(exams.id, results.examId))
          .leftJoin(subjects, sql`${subjects.id} = (select subject_id from exam_subjects es where es.id = ${results.examSubjectId})`)
          .groupBy(exams.name, subjects.name);
        return Response.json({ rows });
      }
      case "library": {
        const rows = await db
          .select({
            Book: books.title,
            Category: books.category,
            Copies: books.totalCopies,
            Available: books.availableCopies,
            TimesIssued: sql<number>`count(${bookLoans.id})::int`,
            Overdue: sql<number>`sum(case when ${bookLoans.status}='overdue' then 1 else 0 end)::int`,
          })
          .from(books)
          .leftJoin(bookLoans, eq(bookLoans.bookId, books.id))
          .groupBy(books.title, books.category, books.totalCopies, books.availableCopies);
        return Response.json({ rows });
      }
      case "transport": {
        const rows = await db
          .select({
            Route: routes.name,
            Fare: routes.fare,
            StudentsAssigned: sql<number>`count(${transportAssignments.id})::int`,
            MonthlyRevenue: sql<string>`coalesce(sum(${transportAssignments.monthlyFee}),0)`,
          })
          .from(routes)
          .leftJoin(transportAssignments, eq(transportAssignments.routeId, routes.id))
          .groupBy(routes.name, routes.fare);
        return Response.json({ rows });
      }
      case "inventory": {
        const rows = await db
          .select({
            Category: inventoryItems.category,
            Items: sql<number>`count(*)::int`,
            Quantity: sql<number>`sum(${inventoryItems.quantity})::int`,
            Value: sql<string>`sum(${inventoryItems.quantity} * ${inventoryItems.unitCost})`,
            Damaged: sql<number>`sum(case when ${inventoryItems.condition}='damaged' then 1 else 0 end)::int`,
          })
          .from(inventoryItems)
          .groupBy(inventoryItems.category);
        return Response.json({ rows });
      }
      default:
        throw new HttpError(400, "Unknown report type");
    }
  } catch (e) {
    return errorResponse(e);
  }
}
