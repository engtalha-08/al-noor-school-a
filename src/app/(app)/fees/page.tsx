"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Card, EmptyState, Modal, PageHeader, StatCard, TableSkeleton, downloadCsv, money, statusTone } from "@/components/ui";

type Invoice = {
  id: number;
  invoiceNo: string;
  period: string;
  issueDate: string;
  dueDate: string;
  status: string;
  studentName: string;
  admissionNo: string;
  className: string | null;
  payable: number;
  paid: number;
  balance: number;
};
type Payment = {
  id: number;
  receiptNo: string;
  amount: string;
  method: string;
  paidOn: string;
  invoiceNo: string | null;
  studentName: string | null;
  voided: boolean;
};

export default function FeesPage() {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState({ billed: 0, collected: 0, outstanding: 0 });
  const [payments, setPayments] = useState<Payment[]>([]);
  const [classes, setClasses] = useState<{ id: number; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [msg, setMsg] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [payFor, setPayFor] = useState<Invoice | null>(null);
  const [genOpen, setGenOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/fees/invoices?q=${encodeURIComponent(q)}&status=${status}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setMsg({ kind: "error", text: data.error });
    setRows(data.rows);
    setSummary(data.summary);
  }, [q, status]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    fetch("/api/fees/payments").then((r) => r.json()).then((d) => setPayments(d.rows ?? [])).catch(() => undefined);
    fetch("/api/lookups").then((r) => r.json()).then((d) => setClasses(d.classes ?? [])).catch(() => undefined);
  }, []);

  async function generate(form: { classId: string; period: string; dueDate: string; includeExamFee: boolean; includeTransport: boolean }) {
    const res = await fetch("/api/fees/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, classId: Number(form.classId) }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg({ kind: "error", text: data.error });
    setGenOpen(false);
    setMsg({ kind: "success", text: `${data.created} invoices generated (${data.skipped} students already invoiced for this period).` });
    void load();
  }

  async function recordPayment(amount: number, method: string, reference: string) {
    if (!payFor) return;
    const res = await fetch("/api/fees/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: payFor.id, amount, method, reference }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg({ kind: "error", text: data.error });
    setMsg({
      kind: "success",
      text: `Receipt ${data.payment.receiptNo} recorded. Invoice is now ${data.invoiceStatus}; remaining balance ${money(data.balance)}.`,
    });
    setPayFor(null);
    void load();
    fetch("/api/fees/payments").then((r) => r.json()).then((d) => setPayments(d.rows ?? []));
  }

  async function voidPayment(id: number) {
    const reason = window.prompt("Reason for voiding this payment (recorded in the audit log):");
    if (!reason) return;
    const res = await fetch("/api/fees/payments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: id, reason }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg({ kind: "error", text: data.error });
    setMsg({ kind: "success", text: "Payment voided and invoice balance recalculated." });
    void load();
    fetch("/api/fees/payments").then((r) => r.json()).then((d) => setPayments(d.rows ?? []));
  }

  return (
    <div>
      <PageHeader
        title="Fees & Invoices"
        subtitle="Invoices, partial payments, receipts and outstanding balances are calculated from recorded transactions."
        actions={
          <>
            <button className="btn-ghost" onClick={() => downloadCsv("invoices.csv", rows as unknown as Record<string, unknown>[])}>
              Export CSV
            </button>
            <button className="btn-primary" onClick={() => setGenOpen(true)}>
              Generate class invoices
            </button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Billed" value={money(summary.billed)} tone="navy" />
        <StatCard label="Collected" value={money(summary.collected)} />
        <StatCard label="Outstanding" value={money(summary.outstanding)} tone="rose" />
      </div>

      {msg && (
        <div className="mb-4">
          <Alert kind={msg.kind}>{msg.text}</Alert>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder="Search student or invoice…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      <div className="table-wrap">
        {loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState title="No invoices found" message="Generate invoices for a class to start billing." />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Student</th>
                <th>Class</th>
                <th>Period</th>
                <th>Due</th>
                <th>Payable</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">{r.invoiceNo}</td>
                  <td className="font-medium">
                    {r.studentName}
                    <span className="block text-xs text-slate-400">{r.admissionNo}</span>
                  </td>
                  <td>{r.className ?? "—"}</td>
                  <td>{r.period}</td>
                  <td>{r.dueDate}</td>
                  <td>{money(r.payable)}</td>
                  <td>{money(r.paid)}</td>
                  <td className={r.balance > 0 ? "font-semibold text-rose-600" : ""}>{money(r.balance)}</td>
                  <td>
                    <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                  </td>
                  <td className="text-right">
                    {r.balance > 0 ? (
                      <button className="text-xs font-semibold text-emerald-700 hover:underline" onClick={() => setPayFor(r)}>
                        Record payment
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Settled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Card className="mt-8">
        <h2 className="mb-3 font-semibold">Recent receipts</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">No payments recorded yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Student</th>
                  <th>Invoice</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Date</th>
                  <th className="text-right">Adjustment</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className={p.voided ? "opacity-50" : ""}>
                    <td className="font-mono text-xs">{p.receiptNo}</td>
                    <td>{p.studentName}</td>
                    <td className="font-mono text-xs">{p.invoiceNo}</td>
                    <td>{money(p.amount)}</td>
                    <td className="capitalize">{p.method}</td>
                    <td>{p.paidOn}</td>
                    <td className="text-right">
                      {p.voided ? (
                        <Badge tone="red">voided</Badge>
                      ) : (
                        <button className="text-xs font-semibold text-rose-600 hover:underline" onClick={() => voidPayment(p.id)}>
                          Void (audited)
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <PaymentModal invoice={payFor} onClose={() => setPayFor(null)} onSubmit={recordPayment} />
      <GenerateModal open={genOpen} classes={classes} onClose={() => setGenOpen(false)} onSubmit={generate} />
    </div>
  );
}

function PaymentModal({
  invoice,
  onClose,
  onSubmit,
}: {
  invoice: Invoice | null;
  onClose: () => void;
  onSubmit: (amount: number, method: string, reference: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  useEffect(() => setAmount(invoice ? String(invoice.balance) : ""), [invoice]);
  if (!invoice) return null;
  return (
    <Modal open title={`Record payment — ${invoice.invoiceNo}`} onClose={onClose}>
      <p className="mb-4 text-sm text-slate-500">
        {invoice.studentName} · outstanding balance <strong>{money(invoice.balance)}</strong>. Partial payments are allowed; the
        invoice is only marked paid when the full balance is received.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(Number(amount), method, reference);
        }}
        className="space-y-4"
      >
        <div>
          <label className="label" htmlFor="amt">Amount received (PKR)</label>
          <input id="amt" type="number" min="1" step="0.01" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="mth">Method</label>
          <select id="mth" className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="bank">Bank transfer</option>
            <option value="cheque">Cheque</option>
            <option value="easypaisa">Easypaisa / JazzCash</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ref">Reference / slip no.</label>
          <input id="ref" className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary">Record payment &amp; issue receipt</button>
        </div>
      </form>
    </Modal>
  );
}

function GenerateModal({
  open,
  classes,
  onClose,
  onSubmit,
}: {
  open: boolean;
  classes: { id: number; label: string }[];
  onClose: () => void;
  onSubmit: (v: { classId: string; period: string; dueDate: string; includeExamFee: boolean; includeTransport: boolean }) => void;
}) {
  const [classId, setClassId] = useState("");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [dueDate, setDueDate] = useState("");
  const [exam, setExam] = useState(false);
  const [transport, setTransport] = useState(false);
  if (!open) return null;
  return (
    <Modal open title="Generate monthly invoices" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ classId, period, dueDate, includeExamFee: exam, includeTransport: transport });
        }}
        className="space-y-4"
      >
        <div>
          <label className="label" htmlFor="gcls">Class</label>
          <select id="gcls" className="input" value={classId} onChange={(e) => setClassId(e.target.value)} required>
            <option value="">Select class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="per">Billing period (YYYY-MM)</label>
          <input id="per" className="input" value={period} onChange={(e) => setPeriod(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="due">Due date</label>
          <input id="due" type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={exam} onChange={(e) => setExam(e.target.checked)} /> Include examination fee
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={transport} onChange={(e) => setTransport(e.target.checked)} /> Include transport fee
        </label>
        <p className="text-xs text-slate-500">
          Amounts are taken from the configured fee structure for the selected class. Students already invoiced for the period
          are skipped automatically.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary">Generate invoices</button>
        </div>
      </form>
    </Modal>
  );
}
