"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Alert, Badge, Card, EmptyState, PageHeader, Spinner, StatCard, money, statusTone } from "@/components/ui";
import { can, roleLabel } from "@/lib/rbac";

type Dash = {
  role: string;
  stats: Record<string, number>;
  charts: {
    attendanceTrend: { date: string; pct: number }[];
    feeTrend: { month: string; collected: number }[];
    expenseTrend: { month: string; spent: number }[];
    enrollmentByClass: { label: string; value: number }[];
  };
  upcomingExams: { id: number; name: string; startDate: string | null; status: string }[];
  upcomingEvents: { id: number; title: string; startDate: string; type: string }[];
  recentAnnouncements: { id: number; title: string; channel: string; status: string; createdAt: string }[];
  recentActivity: { id: number; userName: string | null; action: string; entity: string; createdAt: string }[];
  recentResults: { exam: string; avg: string; count: number }[];
  teacherData: {
    staff: { fullName: string; designation: string };
    periods: { period: number; start: string | null; end: string | null; room: string | null; className: string | null; subject: string | null }[];
    assigned: { className: string | null; subject: string | null }[];
    homework: { id: number; title: string; dueDate: string | null }[];
  } | null;
};

const QUICK: { href: string; label: string; cap: string }[] = [
  { href: "/students", label: "Register a student", cap: "students.write" },
  { href: "/staff", label: "Add a teacher", cap: "staff.write" },
  { href: "/announcements", label: "Send announcement", cap: "announcements.write" },
  { href: "/exams", label: "Publish results", cap: "exams.publish" },
  { href: "/fees", label: "Review fee collection", cap: "fees.read" },
  { href: "/attendance", label: "Check attendance", cap: "attendance.read" },
  { href: "/leaves", label: "Approve leave", cap: "leaves.approve" },
  { href: "/reports", label: "Generate reports", cap: "reports.read" },
];

export default function DashboardClient({ user }: { user: { name: string; role: string } }) {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Unable to load dashboard");
        setData(d);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return <Spinner label="Loading dashboard…" />;

  const s = data.stats;
  const isFinance = can(user.role, "fees.read");

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Assalamu Alaikum, ${user.name}`}
        subtitle={`${roleLabel(user.role)} dashboard · AL NOOR ISLAMIC SCIENCE SCHOOL MIRZAPUR`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active students" value={s.students} hint={`${s.newAdmissions} new this month`} />
        <StatCard label="Teachers" value={s.teachers} hint={`${s.staff} total employees`} tone="navy" />
        <StatCard
          label="Attendance today"
          value={`${s.attendancePct}%`}
          hint={`${s.present} present · ${s.absent} absent · ${s.late} late`}
          tone="gold"
        />
        {isFinance ? (
          <StatCard label="Outstanding fees" value={money(s.outstanding)} hint={`${money(s.collectedMonth)} collected this month`} tone="rose" />
        ) : (
          <StatCard label="Pending leave requests" value={s.pendingLeaves} hint={`${s.pendingAdmissions} admissions awaiting review`} tone="rose" />
        )}
      </div>

      {can(user.role, "students.write") || can(user.role, "announcements.write") ? (
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Quick actions</h2>
          <div className="flex flex-wrap gap-2">
            {QUICK.filter((a) => can(user.role, a.cap)).map((a) => (
              <Link key={a.href + a.label} href={a.href} className="btn-ghost">
                {a.label}
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      {data.teacherData && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 font-semibold">Today&apos;s timetable</h2>
            {data.teacherData.periods.length === 0 ? (
              <p className="text-sm text-slate-500">No periods scheduled for you today.</p>
            ) : (
              <ul className="space-y-2">
                {data.teacherData.periods.map((p) => (
                  <li key={p.period} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
                    <span className="font-medium">
                      P{p.period} · {p.subject ?? "—"}
                    </span>
                    <span className="text-slate-500">
                      {p.className} · {p.start ?? ""}–{p.end ?? ""} {p.room ? `· ${p.room}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/attendance" className="btn-primary mt-4">
              Mark attendance
            </Link>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">My classes &amp; recent homework</h2>
            <div className="mb-3 flex flex-wrap gap-2">
              {data.teacherData.assigned.map((a, i) => (
                <Badge key={i} tone="green">
                  {a.className} · {a.subject ?? "All subjects"}
                </Badge>
              ))}
            </div>
            <ul className="space-y-2 text-sm">
              {data.teacherData.homework.map((h) => (
                <li key={h.id} className="flex justify-between border-b border-slate-100 pb-1 dark:border-slate-800">
                  <span>{h.title}</span>
                  <span className="text-slate-500">due {h.dueDate ?? "—"}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">Attendance trend (last 14 days)</h2>
          {data.charts.attendanceTrend.length === 0 ? (
            <EmptyState title="No attendance recorded yet" message="Attendance charts appear once teachers submit daily attendance." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.charts.attendanceTrend}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#047857" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#047857" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" fontSize={11} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis domain={[0, 100]} fontSize={11} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Area type="monotone" dataKey="pct" name="Present %" stroke="#047857" fill="url(#g1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold">Enrollment by class</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.charts.enrollmentByClass}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip />
              <Bar dataKey="value" name="Students" fill="#0f2742" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {isFinance && (
        <Card>
          <h2 className="mb-4 font-semibold">Fee collection vs expenses</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={data.charts.feeTrend.map((f) => ({
                month: f.month,
                collected: f.collected,
                spent: data.charts.expenseTrend.find((e) => e.month === f.month)?.spent ?? 0,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v) => money(Number(v))} />
              <Legend />
              <Line type="monotone" dataKey="collected" name="Fees collected" stroke="#047857" strokeWidth={2} />
              <Line type="monotone" dataKey="spent" name="Expenses" stroke="#c9a227" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Billed (all time)" value={money(s.billed)} tone="slate" />
            <StatCard label="Collected" value={money(s.collectedAll)} />
            <StatCard label="Outstanding" value={money(s.outstanding)} tone="rose" />
            <StatCard label="Expenses this month" value={money(s.expensesMonth)} tone="gold" />
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="mb-3 font-semibold">Pending tasks</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span>Leave requests awaiting decision</span>
              <Badge tone={s.pendingLeaves ? "amber" : "green"}>{s.pendingLeaves}</Badge>
            </li>
            <li className="flex justify-between">
              <span>Admission applications in review</span>
              <Badge tone={s.pendingAdmissions ? "amber" : "green"}>{s.pendingAdmissions}</Badge>
            </li>
            <li className="flex justify-between">
              <span>Open complaints</span>
              <Badge tone={s.openComplaints ? "red" : "green"}>{s.openComplaints}</Badge>
            </li>
            <li className="flex justify-between">
              <span>Books currently issued</span>
              <Badge tone="blue">{s.booksOut}</Badge>
            </li>
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Upcoming examinations</h2>
          {data.upcomingExams.length === 0 ? (
            <p className="text-sm text-slate-500">No examinations scheduled.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.upcomingExams.map((e) => (
                <li key={e.id} className="flex items-center justify-between">
                  <span>{e.name}</span>
                  <span className="text-slate-500">{e.startDate}</span>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mb-2 mt-4 text-xs font-semibold uppercase text-slate-500">Recent result averages</h3>
          <ul className="space-y-1 text-sm">
            {data.recentResults.map((r, i) => (
              <li key={i} className="flex justify-between">
                <span>{r.exam}</span>
                <span className="text-slate-500">
                  avg {r.avg} · {r.count} entries
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Upcoming events</h2>
          {data.upcomingEvents.length === 0 ? (
            <p className="text-sm text-slate-500">No events in the calendar.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.upcomingEvents.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{e.title}</span>
                  <Badge tone="blue">{e.startDate}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Recent announcements</h2>
          {data.recentAnnouncements.length === 0 ? (
            <p className="text-sm text-slate-500">No announcements sent yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.recentAnnouncements.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{a.title}</span>
                  <span className="flex items-center gap-2">
                    <Badge tone="slate">{a.channel}</Badge>
                    <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Recent system activity</h2>
          <ul className="space-y-2 text-sm">
            {data.recentActivity.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  <span className="font-medium">{a.userName}</span> · {a.action.replace(/_/g, " ")} ({a.entity})
                </span>
                <span className="shrink-0 text-xs text-slate-400">{new Date(a.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
