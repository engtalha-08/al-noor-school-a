"use client";

import { useEffect, useState } from "react";
import ResourcePage from "@/components/resource-page";
import Tabs from "@/components/tabs";
import { Alert, Badge, Card, Confirm, EmptyState, PageHeader, Spinner, statusTone } from "@/components/ui";

type Paper = { id: number; subjectName: string | null; maxMarks: number; passMarks: number; examDate: string | null };
type Student = { id: number; fullName: string; admissionNo: string };
type Mark = { examSubjectId: number; studentId: number; marksObtained: string; grade: string | null };
type Exam = { id: number; name: string; status: string; startDate: string | null };

export default function ExamsClient({ canWrite, canPublish }: { canWrite: boolean; canPublish: boolean }) {
  return (
    <Tabs
      tabs={[
        { key: "exams", label: "Examinations", content: <ResourcePage resource="exams" canWrite={canWrite} /> },
        { key: "papers", label: "Exam Papers & Marks Scheme", content: <ResourcePage resource="examSubjects" canWrite={canWrite} /> },
        { key: "marks", label: "Marks Entry & Publication", content: <MarksEntry canWrite={canWrite} canPublish={canPublish} /> },
      ]}
    />
  );
}

function MarksEntry({ canWrite, canPublish }: { canWrite: boolean; canPublish: boolean }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");
  const [exam, setExam] = useState<Exam | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [roster, setRoster] = useState<Student[]>([]);
  const [grid, setGrid] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);

  useEffect(() => {
    fetch("/api/resources/exams?pageSize=100")
      .then((r) => r.json())
      .then((d) => setExams(d.rows ?? []))
      .catch(() => undefined);
  }, []);

  async function load(id: string) {
    setExamId(id);
    if (!id) return;
    setLoading(true);
    const res = await fetch(`/api/exams/${id}/results`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setMsg({ kind: "error", text: data.error });
    setExam(data.exam);
    setPapers(data.papers);
    setRoster(data.roster);
    const g: Record<string, string> = {};
    (data.marks as Mark[]).forEach((m) => (g[`${m.examSubjectId}:${m.studentId}`] = String(Number(m.marksObtained))));
    setGrid(g);
    setMsg(
      data.papers.length === 0
        ? { kind: "info", text: "No subjects have been added to this exam yet. Add them in the Exam Papers tab." }
        : null,
    );
  }

  async function save() {
    const entries = Object.entries(grid)
      .filter(([, v]) => v !== "")
      .map(([k, v]) => {
        const [examSubjectId, studentId] = k.split(":").map(Number);
        return { examSubjectId, studentId, marks: Number(v) };
      });
    if (!entries.length) return setMsg({ kind: "error", text: "Enter at least one mark before saving." });
    const res = await fetch(`/api/exams/${examId}/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg({ kind: "error", text: data.error });
    setMsg({ kind: "success", text: `${data.saved} marks saved. Grades were calculated using the configured grading rules.` });
  }

  async function publish() {
    setConfirmPublish(false);
    const res = await fetch(`/api/exams/${examId}/publish`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return setMsg({ kind: "error", text: data.error });
    setMsg({ kind: "success", text: `${data.published} result rows published. Students and parents can now view them.` });
    void load(examId);
  }

  const totalFor = (studentId: number) =>
    papers.reduce((s, p) => s + (Number(grid[`${p.id}:${studentId}`]) || 0), 0);
  const maxTotal = papers.reduce((s, p) => s + p.maxMarks, 0);

  return (
    <div>
      <PageHeader
        title="Marks Entry & Result Publication"
        subtitle="Grades follow the school's configured grading policy. Published results can only be corrected by the Principal."
        actions={
          canPublish && exam && exam.status !== "published" ? (
            <button className="btn-primary" onClick={() => setConfirmPublish(true)} disabled={!examId}>
              Publish results
            </button>
          ) : exam?.status === "published" ? (
            <Badge tone="green">Results published</Badge>
          ) : null
        }
      />

      <Card className="mb-6">
        <label className="label" htmlFor="ex">Select examination</label>
        <select id="ex" className="input max-w-md" value={examId} onChange={(e) => load(e.target.value)}>
          <option value="">Select…</option>
          {exams.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.status})
            </option>
          ))}
        </select>
      </Card>

      {msg && (
        <div className="mb-4">
          <Alert kind={msg.kind}>{msg.text}</Alert>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : !examId ? (
        <Card>
          <EmptyState title="No examination selected" message="Choose an examination to enter or review marks." />
        </Card>
      ) : roster.length === 0 || papers.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing to mark yet"
            message="This exam needs an assigned class with active students and at least one exam paper."
          />
        </Card>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Student</th>
                  {papers.map((p) => (
                    <th key={p.id}>
                      {p.subjectName ?? "Subject"} <span className="font-normal text-slate-400">/{p.maxMarks}</span>
                    </th>
                  ))}
                  <th>Total</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((s) => {
                  const total = totalFor(s.id);
                  const pct = maxTotal ? Math.round((total / maxTotal) * 100) : 0;
                  return (
                    <tr key={s.id}>
                      <td className="font-medium">
                        {s.fullName}
                        <span className="block text-xs text-slate-400">{s.admissionNo}</span>
                      </td>
                      {papers.map((p) => (
                        <td key={p.id}>
                          <input
                            type="number"
                            min={0}
                            max={p.maxMarks}
                            disabled={!canWrite}
                            className="input w-24 py-1"
                            value={grid[`${p.id}:${s.id}`] ?? ""}
                            onChange={(e) => setGrid((g) => ({ ...g, [`${p.id}:${s.id}`]: e.target.value }))}
                          />
                        </td>
                      ))}
                      <td className="font-semibold">
                        {total}/{maxTotal}
                      </td>
                      <td>
                        <Badge tone={statusTone(pct >= 40 ? "active" : "absent")}>{pct}%</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {canWrite && (
            <div className="mt-4 flex justify-end">
              <button className="btn-primary" onClick={save}>
                Save marks
              </button>
            </div>
          )}
        </>
      )}

      <Confirm
        open={confirmPublish}
        title="Publish examination results?"
        message="Published results become visible to students and parents and can afterwards only be corrected by the Principal, with every change written to the audit log."
        confirmLabel="Publish results"
        onCancel={() => setConfirmPublish(false)}
        onConfirm={publish}
      />
      <p className="mt-6 text-xs text-slate-400">Class and subject performance analysis is available in the Reports module.</p>
    </div>
  );
}
