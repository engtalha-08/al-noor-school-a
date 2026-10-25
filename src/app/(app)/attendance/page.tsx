"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Card, EmptyState, PageHeader, Spinner, StatCard, statusTone } from "@/components/ui";

type Student = { id: number; fullName: string; admissionNo: string; sectionId: number | null };
type Existing = { studentId: number; status: string; remarks: string | null };
type Option = { id: number; label: string };

const STATUSES = ["present", "absent", "late", "leave"];

export default function AttendancePage() {
  const [lookups, setLookups] = useState<{ classes: Option[]; sections: Option[] }>({ classes: [], sections: [] });
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [session, setSession] = useState("full-day");
  const [roster, setRoster] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [alreadyMarked, setAlreadyMarked] = useState(false);

  useEffect(() => {
    fetch("/api/lookups")
      .then((r) => r.json())
      .then((d) => setLookups({ classes: d.classes ?? [], sections: d.sections ?? [] }))
      .catch(() => undefined);
  }, []);

  async function load() {
    if (!classId) {
      setMessage({ kind: "error", text: "Please select a class first." });
      return;
    }
    setLoading(true);
    setMessage(null);
    const res = await fetch(
      `/api/attendance?classId=${classId}&date=${date}&session=${session}${sectionId ? `&sectionId=${sectionId}` : ""}`,
    );
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage({ kind: "error", text: data.error });
      return;
    }
    setRoster(data.roster);
    const existing: Existing[] = data.existing;
    setAlreadyMarked(existing.length > 0);
    const m: Record<number, string> = {};
    data.roster.forEach((s: Student) => (m[s.id] = existing.find((e) => e.studentId === s.id)?.status ?? "present"));
    setMarks(m);
    if (existing.length) {
      setMessage({
        kind: "info",
        text: `Attendance for this class, date and session has already been submitted (${existing.length} records). Saving again records an authorised correction.`,
      });
    }
  }

  async function submit() {
    setSaving(true);
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId: Number(classId),
        sectionId: sectionId ? Number(sectionId) : null,
        date,
        session,
        entries: roster.map((s) => ({ studentId: s.id, status: marks[s.id] ?? "present" })),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage({ kind: "error", text: data.error });
      return;
    }
    setAlreadyMarked(true);
    setMessage({
      kind: "success",
      text: `Attendance saved for ${data.saved} students. ${data.absentees} marked absent — absence alerts can be sent from the Announcements module.`,
    });
  }

  const counts = STATUSES.map((s) => ({ s, n: Object.values(marks).filter((v) => v === s).length }));

  return (
    <div>
      <PageHeader title="Student Attendance" subtitle="Mark daily attendance per class and session. Duplicate submissions are prevented." />

      <Card className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="label" htmlFor="cls">Class</label>
            <select id="cls" className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Select class…</option>
              {lookups.classes.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="sec">Section (optional)</label>
            <select id="sec" className="input" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">All sections</option>
              {lookups.sections.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="dt">Date</label>
            <input id="dt" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="ses">Session</label>
            <select id="ses" className="input" value={session} onChange={(e) => setSession(e.target.value)}>
              <option value="full-day">Full day</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full" onClick={load}>Load class list</button>
          </div>
        </div>
      </Card>

      {message && (
        <div className="mb-4">
          <Alert kind={message.kind}>{message.text}</Alert>
        </div>
      )}

      {loading ? (
        <Spinner label="Loading class list…" />
      ) : roster.length === 0 ? (
        <Card>
          <EmptyState title="No class loaded" message="Select a class and date, then load the class list to begin marking attendance." />
        </Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {counts.map((c) => (
              <StatCard key={c.s} label={c.s} value={c.n} tone={c.s === "absent" ? "rose" : c.s === "present" ? "emerald" : "gold"} />
            ))}
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                className="btn-ghost"
                onClick={() => setMarks(Object.fromEntries(roster.map((r) => [r.id, s])))}
              >
                Mark all {s}
              </button>
            ))}
          </div>

          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Admission No</th>
                  <th>Student</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((s) => (
                  <tr key={s.id}>
                    <td>{s.admissionNo}</td>
                    <td className="font-medium">{s.fullName}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {STATUSES.map((st) => (
                          <button
                            key={st}
                            onClick={() => setMarks((m) => ({ ...m, [s.id]: st }))}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition ${
                              marks[s.id] === st
                                ? "bg-emerald-700 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <Badge tone={statusTone(alreadyMarked ? "submitted" : "pending")}>
              {alreadyMarked ? "Previously submitted — saving records a correction" : "Not yet submitted"}
            </Badge>
            <button className="btn-primary" onClick={submit} disabled={saving}>
              {saving ? "Submitting…" : "Submit attendance"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
