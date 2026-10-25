import { db } from "@/db";
import { desc, eq, sql, and } from "drizzle-orm";
import { invoices, payments, students } from "@/db/schema";
import { requireCap, audit, errorResponse, HttpError } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    await requireCap("fees.read");
    const url = new URL(req.url);
    const invoiceId = url.searchParams.get("invoiceId");
    const rows = await db
      .select({
        id: payments.id,
        receiptNo: payments.receiptNo,
        amount: payments.amount,
        method: payments.method,
        paidOn: payments.paidOn,
        reference: payments.reference,
        voided: payments.voided,
        invoiceNo: invoices.invoiceNo,
        studentName: students.fullName,
      })
      .from(payments)
      .leftJoin(invoices, eq(invoices.id, payments.invoiceId))
      .leftJoin(students, eq(students.id, payments.studentId))
      .where(invoiceId ? eq(payments.invoiceId, Number(invoiceId)) : undefined)
      .orderBy(desc(payments.id))
      .limit(100);
    return Response.json({ rows });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireCap("fees.write");
    const body = (await req.json()) as {
      invoiceId: number;
      amount: number;
      method?: string;
      reference?: string;
      paidOn?: string;
    };
    if (!body.invoiceId || !body.amount || Number(body.amount) <= 0) {
      throw new HttpError(422, "A valid invoice and a positive payment amount are required");
    }
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, body.invoiceId));
    if (!inv) throw new HttpError(404, "Invoice not found");
    if (inv.status === "cancelled") throw new HttpError(409, "This invoice has been cancelled");

    const [{ v: paidSoFar }] = await db
      .select({ v: sql<string>`coalesce(sum(${payments.amount}),0)` })
      .from(payments)
      .where(and(eq(payments.invoiceId, inv.id), eq(payments.voided, false)));

    const payable = Number(inv.amount) - Number(inv.discount) + Number(inv.lateFee);
    const balance = payable - Number(paidSoFar);
    if (Number(body.amount) > balance + 0.001) {
      throw new HttpError(422, `Payment exceeds the outstanding balance of PKR ${balance.toFixed(0)}`);
    }

    const [{ v: seq }] = await db.select({ v: sql<number>`coalesce(max(id),0)::int` }).from(payments);
    const receiptNo = `RCPT-${new Date().getFullYear()}-${String(seq + 1).padStart(6, "0")}`;

    const [payment] = await db
      .insert(payments)
      .values({
        receiptNo,
        invoiceId: inv.id,
        studentId: inv.studentId,
        amount: String(body.amount),
        method: body.method ?? "cash",
        reference: body.reference ?? null,
        paidOn: body.paidOn ?? new Date().toISOString().slice(0, 10),
        recordedBy: user.id,
      })
      .returning();

    const newPaid = Number(paidSoFar) + Number(body.amount);
    const status = newPaid >= payable - 0.001 ? "paid" : newPaid > 0 ? "partial" : "unpaid";
    await db.update(invoices).set({ status, updatedAt: new Date() }).where(eq(invoices.id, inv.id));

    await audit(user, "payment_record", "payments", payment.id, `invoice ${inv.invoiceNo}, PKR ${body.amount}`);
    return Response.json({ payment, invoiceStatus: status, balance: payable - newPaid }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Controlled adjustment: void a payment (audited, never hard-deleted). */
export async function PATCH(req: Request) {
  try {
    const user = await requireCap("fees.write");
    const { paymentId, reason } = (await req.json()) as { paymentId: number; reason?: string };
    const [p] = await db.select().from(payments).where(eq(payments.id, paymentId));
    if (!p) throw new HttpError(404, "Payment not found");
    if (p.voided) throw new HttpError(409, "This payment is already voided");
    await db.update(payments).set({ voided: true }).where(eq(payments.id, paymentId));

    const [inv] = await db.select().from(invoices).where(eq(invoices.id, p.invoiceId));
    if (inv) {
      const [{ v: paidSoFar }] = await db
        .select({ v: sql<string>`coalesce(sum(${payments.amount}),0)` })
        .from(payments)
        .where(and(eq(payments.invoiceId, inv.id), eq(payments.voided, false)));
      const payable = Number(inv.amount) - Number(inv.discount) + Number(inv.lateFee);
      const status = Number(paidSoFar) >= payable - 0.001 ? "paid" : Number(paidSoFar) > 0 ? "partial" : "unpaid";
      await db.update(invoices).set({ status, updatedAt: new Date() }).where(eq(invoices.id, inv.id));
    }
    await audit(user, "payment_void", "payments", paymentId, reason ?? "no reason supplied");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
