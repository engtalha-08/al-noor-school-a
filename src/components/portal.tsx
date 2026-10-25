"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Card, EmptyState, PageHeader, Spinner, StatCard, money, statusTone } from "@/components/ui";

type Portal = {
  mode: "student" | "parent";
  guardian?: { fullName: string; phone: string };
  kids?: { id: number; fullName: string; admissionNo: string }[];
  announcements: { id: number; title: string; body: string; createdAt: string }[];
  events: { id: number; title: string; startDate: string; type: string }[];
  notifications: { id: number; title: string; body: string | null; createdAt: string }[];
  data: {
    student: { id: number; fullName: string; admissionNo: string; className: string | null; sectionName: string | null; status: string; dob: string | null };
    attendance: { percentage: number; total: number; summary: Record<string, number>; recent: { id: number; date: string; status: string }[] };
    timetable: { dayOfWeek: number; period: number; startTime: string | null; endTime: string | null; subject: string | null; teacher: string | null; room: string | null }[];
    homework: { id: number; title: string; dueDate: string | null; subject: string | null; instructions: string | null }[];
    upcomingExams: { id: number; name: string; startDate: string | null }[];
    results: { exam: string; subject: string | null; marks: string; max: number; grade: string | null }[];
    fees: null | {
      payable: number;
      paid: number;
      outstanding: number;
      invoices: { id: number; invoiceNo: string; period: string; dueDate: string; status: string; amount: string }[];
      payments: { id: number; receiptNo: string; amount: string; paidOn: string; voided: boolean }[];
    };
  } | null;
};

const DAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function PortalView({ expected }: { expected: "student" | "parent" }) {
  const [data, setData] = useState<Portal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [childId, setChildId] = useState<number | null>(null);

  const load = useCallback(async (id: number | null) => {
    const res = await fetch(`/api/portal${id ? `?studentId=${id}` : ""}`);
    const d = await res.json();
    if (!res.ok) {
      setError(d.error);
      return;
    }
    setError(null);
    setData(d);
  }, []);

  useEffect(() => {
    void load(childId);
  }, [load, childId]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return <Spinner label="Loading portal…" />;
  if (!data.data)
    return (
      <Card>
        <EmptyState title="No linked student records" message="Please contact the school office to link your children to this account." />
      </Card>
    );

  const d = data.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={expected === "parent" ? `Parent Portal — ${data.guardian?.fullName ?? ""}` : "Student Portal"}
        subtitle={`${d.student.fullName} · ${d.student.admissionNo} · ${d.student.className ?? "—"} ${d.student.sectionName ?? ""}`}
      />

      {data.mode === "parent" && (data.kids?.length ?? 0) > 0 && (
        <Card>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">My children</p>
          <div className="flex flex-wrap gap-2">
            {data.kids!.map((k) => (
              <button
                key={k.id}
                onClick={() => setChildId(k.id)}
                className={`rounded-xl px-3.5 py-2 text-sm font-medium ${
                  d.student.id === k.id ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                {k.fullName}
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Attendance" value={`${d.attendance.percentage}%`} hint={`${d.attendance.total} records`} />
        <StatCard label="Absences" value={d.attendance.summary.absent ?? 0} tone="rose" />
        <StatCard label="Homework" value={d.homework.length} tone="navy" />
        {d.fees ? (
          <StatCard label="Outstanding fees" value={money(d.fees.outstanding)} tone="gold" />
        ) : (
          <StatCard label="Published results" value={d.results.length} tone="gold" />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Class timetable</h2>
          {d.timetable.length === 0 ? (
            <p className="text-sm text-slate-500">The timetable has not been published yet.</p>
          ) : (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((day) => {
                const periods = d.timetable.filter((t) => t.dayOfWeek === day);
                if (!periods.length) return null;
                return (
                  <div key={day}>
                    <p className="text-xs font-semibold uppercase text-emerald-700">{DAYS[day]}</p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {periods.map((p, i) => (
                        <li key={i} className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-slate-800/60">
                          <span>
                            P{p.period} · {p.subject ?? "—"}
                          </span>
                          <span className="text-slate-500">
                            {p.startTime}–{p.endTime} {p.teacher ? `· ${p.teacher}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Homework & assignments</h2>
          {d.homework.length === 0 ? (
            <p className="text-sm text-slate-500">No homework has been assigned.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {d.homework.map((h) => (
                <li key={h.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{h.title}</span>
                    <Badge tone="amber">due {h.dueDate ?? "—"}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {h.subject ?? ""} {h.instructions ? `· ${h.instructions}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Published results</h2>
          {d.results.length === 0 ? (
            <p className="text-sm text-slate-500">No results have been published yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Exam</th>
                    <th>Subject</th>
                    <th>Marks</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {d.results.map((r, i) => (
                    <tr key={i}>
                      <td>{r.exam}</td>
                      <td>{r.subject ?? "—"}</td>
                      <td>
                        {Number(r.marks)}/{r.max}
                      </td>
                      <td>
                        <Badge tone="green">{r.grade}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h3 className="mb-2 mt-4 text-xs font-semibold uppercase text-slate-500">Upcoming examinations</h3>
          <ul className="space-y-1 text-sm">
            {d.upcomingExams.map((e) => (
              <li key={e.id} className="flex justify-between">
                <span>{e.name}</span>
                <span className="text-slate-500">{e.startDate}</span>
              </li>
            ))}
            {d.upcomingExams.length === 0 && <li className="text-slate-500">None scheduled.</li>}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Recent attendance</h2>
          <ul className="space-y-1 text-sm">
            {d.attendance.recent.map((a) => (
              <li key={a.id} className="flex justify-between">
                <span>{a.date}</span>
                <Badge tone={statusTone(a.status)}>{a.status}</Badge>
              </li>
            ))}
            {d.attendance.recent.length === 0 && <li className="text-slate-500">No attendance recorded.</li>}
          </ul>
        </Card>
      </div>

      {d.fees && (
        <Card>
          <h2 className="mb-3 font-semibold">Fee invoices &amp; payment history</h2>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <StatCard label="Billed" value={money(d.fees.payable)} tone="navy" />
            <StatCard label="Paid" value={money(d.fees.paid)} />
            <StatCard label="Outstanding" value={money(d.fees.outstanding)} tone="rose" />
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Period</th>
                  <th>Due</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {d.fees.invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="font-mono text-xs">{i.invoiceNo}</td>
                    <td>{i.period}</td>
                    <td>{i.dueDate}</td>
                    <td>{money(i.amount)}</td>
                    <td>
                      <Badge tone={statusTone(i.status)}>{i.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="mb-2 mt-4 text-xs font-semibold uppercase text-slate-500">Receipts</h3>
          <ul className="space-y-1 text-sm">
            {d.fees.payments.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span className="font-mono text-xs">{p.receiptNo}</span>
                <span>
                  {money(p.amount)} · {p.paidOn} {p.voided ? "(voided)" : ""}
                </span>
              </li>
            ))}
            {d.fees.payments.length === 0 && <li className="text-slate-500">No payments recorded.</li>}
          </ul>
          <p className="mt-3 text-xs text-slate-400">
            Online payment is not enabled. Payments are confirmed only once recorded by the school accountant.
          </p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">School announcements</h2>
          {data.announcements.length === 0 ? (
            <p className="text-sm text-slate-500">No announcements.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.announcements.map((a) => (
                <li key={a.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                  <p className="font-medium">{a.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">School calendar</h2>
          <ul className="space-y-1 text-sm">
            {data.events.map((e) => (
              <li key={e.id} className="flex justify-between">
                <span>{e.title}</span>
                <Badge tone="blue">{e.startDate}</Badge>
              </li>
            ))}
            {data.events.length === 0 && <li className="text-slate-500">No upcoming events.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
