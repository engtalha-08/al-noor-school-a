import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import { leaveRequests, admissions, students, expenses, enrollments, academicYears } from "@/db/schema";
import { requireCap, audit, errorResponse, HttpError } from "@/lib/auth";

/**
 * Workflow actions: leave approval, admission decisions, admission → student registration,
 * and expense approval. All actions are audited.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action: string;
      id: number;
      decision?: "approved" | "rejected";
      comment?: string;
      classId?: number;
      sectionId?: number;
    };

    switch (body.action) {
      case "leave.decide": {
        const user = await requireCap("leaves.approve");
        if (!body.decision) throw new HttpError(422, "A decision is required");
        const [row] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, body.id));
        if (!row) throw new HttpError(404, "Leave request not found");
        if (row.status !== "pending") throw new HttpError(409, "This request has already been decided");
        await db
          .update(leaveRequests)
          .set({ status: body.decision, approverComment: body.comment ?? null, decidedBy: user.id })
          .where(eq(leaveRequests.id, body.id));
        await audit(user, `leave_${body.decision}`, "leave_requests", body.id, body.comment);
        return Response.json({ ok: true });
      }
      case "admission.decide": {
        const user = await requireCap("admissions.write");
        if (!body.decision) throw new HttpError(422, "A decision is required");
        if (body.decision === "approved" && user.role !== "principal" && user.role !== "admin") {
          throw new HttpError(403, "Only the Principal or Administrator may approve an admission");
        }
        const [row] = await db.select().from(admissions).where(eq(admissions.id, body.id));
        if (!row) throw new HttpError(404, "Application not found");
        if (row.status === "registered") throw new HttpError(409, "This applicant is already registered");
        if (body.decision === "approved" && !row.documentsVerified) {
          throw new HttpError(422, "Documents must be verified before approval");
        }
        await db
          .update(admissions)
          .set({ status: body.decision, reviewNotes: body.comment ?? row.reviewNotes, decidedBy: user.id, updatedAt: new Date() })
          .where(eq(admissions.id, body.id));
        await audit(user, `admission_${body.decision}`, "admissions", body.id, body.comment);
        return Response.json({ ok: true });
      }
      case "admission.register": {
        const user = await requireCap("students.write");
        const [row] = await db.select().from(admissions).where(eq(admissions.id, body.id));
        if (!row) throw new HttpError(404, "Application not found");
        if (row.status !== "approved") throw new HttpError(409, "Only approved applications can be registered");
        const classId = body.classId ?? row.appliedClassId;
        if (!classId) throw new HttpError(422, "A class must be selected");

        const dup = await db
          .select()
          .from(students)
          .where(sql`lower(${students.fullName}) = lower(${row.applicantName}) and ${students.dob} is not distinct from ${row.dob}`);
        if (dup.length) throw new HttpError(409, "A student with the same name and date of birth already exists");

        const [{ v: seq }] = await db.select({ v: sql<number>`coalesce(max(id),0)::int` }).from(students);
        const [year] = await db.select().from(academicYears).where(eq(academicYears.isCurrent, true)).limit(1);
        const [student] = await db
          .insert(students)
          .values({
            admissionNo: `ANS-${new Date().getFullYear()}-${String(seq + 1).padStart(4, "0")}`,
            fullName: row.applicantName,
            dob: row.dob,
            gender: row.gender,
            classId,
            sectionId: body.sectionId ?? null,
            academicYearId: year?.id ?? null,
            admissionDate: new Date().toISOString().slice(0, 10),
            previousSchool: row.previousSchool,
            emergencyContact: row.guardianPhone,
            status: "active",
          })
          .returning();
        if (year) {
          await db.insert(enrollments).values({
            studentId: student.id,
            classId,
            sectionId: body.sectionId ?? null,
            academicYearId: year.id,
          });
        }
        await db.update(admissions).set({ status: "registered", updatedAt: new Date() }).where(eq(admissions.id, body.id));
        await audit(user, "admission_register", "students", student.id, `from application ${row.applicationNo}`);
        return Response.json({ student }, { status: 201 });
      }
      case "expense.decide": {
        const user = await requireCap("expenses.write");
        if (!body.decision) throw new HttpError(422, "A decision is required");
        await db
          .update(expenses)
          .set({ status: body.decision, approvedBy: user.id })
          .where(eq(expenses.id, body.id));
        await audit(user, `expense_${body.decision}`, "expenses", body.id);
        return Response.json({ ok: true });
      }
      default:
        throw new HttpError(400, "Unknown workflow action");
    }
  } catch (e) {
    return errorResponse(e);
  }
}
