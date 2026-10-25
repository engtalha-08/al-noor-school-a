import { db } from "@/db";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { invoices, payments, students, classes, feeStructures } from "@/db/schema";
import { requireCap, audit, errorResponse, HttpError } from "@/lib/auth";

const paidSub = sql<string>`coalesce((select sum(p.amount) from payments p where p.invoice_id = ${invoices.id} and p.voided = false),0)`;

export async function GET(req: Request) {
  try {
    await requireCap("fees.read");
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const status = url.searchParams.get("status");
    const classId = url.searchParams.get("classId");
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const pageSize = 25;

    const where = and(
      q ? or(ilike(students.fullName, `%${q}%`), ilike(invoices.invoiceNo, `%${q}%`), ilike(students.admissionNo, `%${q}%`)) : undefined,
      status ? eq(invoices.status, status) : undefined,
      classId ? eq(students.classId, Number(classId)) : undefined,
    );

    const rows = await db
      .select({
        id: invoices.id,
        invoiceNo: invoices.invoiceNo,
        period: invoices.period,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        amount: invoices.amount,
        discount: invoices.discount,
        lateFee: invoices.lateFee,
        status: invoices.status,
        studentId: invoices.studentId,
        studentName: students.fullName,
        admissionNo: students.admissionNo,
        className: classes.name,
        paid: paidSub,
      })
      .from(invoices)
      .leftJoin(students, eq(students.id, invoices.studentId))
      .leftJoin(classes, eq(classes.id, students.classId))
      .where(where)
      .orderBy(desc(invoices.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [{ value: total }] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(invoices)
      .leftJoin(students, eq(students.id, invoices.studentId))
      .where(where);

    const [totals] = await db
      .select({
        billed: sql<string>`coalesce(sum(${invoices.amount} - ${invoices.discount} + ${invoices.lateFee}),0)`,
      })
      .from(invoices)
      .where(sql`${invoices.status} <> 'cancelled'`);
    const [collected] = await db
      .select({ v: sql<string>`coalesce(sum(${payments.amount}),0)` })
      .from(payments)
      .where(eq(payments.voided, false));

    return Response.json({
      rows: rows.map((r) => ({
        ...r,
        payable: Number(r.amount) - Number(r.discount) + Number(r.lateFee),
        paid: Number(r.paid),
        balance: Number(r.amount) - Number(r.discount) + Number(r.lateFee) - Number(r.paid),
      })),
      total,
      page,
      summary: {
        billed: Number(totals.billed),
        collected: Number(collected.v),
        outstanding: Number(totals.billed) - Number(collected.v),
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Generate invoices for a class for a billing period from the configured fee structure. */
export async function POST(req: Request) {
  try {
    const user = await requireCap("fees.write");
    const body = (await req.json()) as {
      classId: number;
      period: string;
      dueDate: string;
      includeExamFee?: boolean;
      includeTransport?: boolean;
    };
    if (!body.classId || !body.period || !body.dueDate) {
      throw new HttpError(422, "Class, billing period and due date are required");
    }
    const [fs] = await db.select().from(feeStructures).where(eq(feeStructures.classId, body.classId)).limit(1);
    if (!fs) throw new HttpError(422, "No fee structure configured for this class");

    const roster = await db
      .select()
      .from(students)
      .where(and(eq(students.classId, body.classId), eq(students.status, "active")));
    if (!roster.length) throw new HttpError(422, "No active students found in this class");

    const amount =
      Number(fs.tuitionFee) +
      (body.includeExamFee ? Number(fs.examFee) : 0) +
      (body.includeTransport ? Number(fs.transportFee) : 0) +
      Number(fs.otherCharges);

    const existing = await db
      .select({ studentId: invoices.studentId })
      .from(invoices)
      .where(eq(invoices.period, body.period));
    const existingIds = new Set(existing.map((e) => e.studentId));

    const toCreate = roster.filter((s) => !existingIds.has(s.id));
    if (!toCreate.length) throw new HttpError(409, "Invoices for this period already exist for every student in the class");

    const [{ v: seq }] = await db.select({ v: sql<number>`coalesce(max(id),0)::int` }).from(invoices);
    const values = toCreate.map((s, i) => ({
      invoiceNo: `INV-${body.period.replace("-", "")}-${String(seq + i + 1).padStart(5, "0")}`,
      studentId: s.id,
      period: body.period,
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: body.dueDate,
      amount: String(amount),
    }));
    const created = await db.insert(invoices).values(values).returning();
    await audit(user, "invoices_generate", "invoices", body.period, `${created.length} invoices, class ${body.classId}`);
    return Response.json({ created: created.length, skipped: roster.length - created.length }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
