"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import ResourcePage from "@/components/resource-page";
import Tabs from "@/components/tabs";
import { Alert, Badge, Card, EmptyState, PageHeader, Spinner, TableSkeleton, statusTone } from "@/components/ui";

type Application = {
  id: number;
  applicationNo: string;
  applicantName: string;
  guardianName: string;
  guardianPhone: string;
  appliedClassId: number | null;
  documentsVerified: boolean;
  status: string;
  reviewNotes: string | null;
};

export default function AdmissionsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Tabs
        tabs={[
          { key: "pipeline", label: "Admission Pipeline", content: <Pipeline /> },
          { key: "all", label: "All Applications", content: <ResourcePage resource="admissions" /> },
        ]}
      />
    </Suspense>
  );
}

const STAGES = ["submitted", "documents_reviewed", "approved", "rejected", "registered"];

function Pipeline() {
  const [rows, setRows] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/resources/admissions?pageSize=100");
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setMsg({ kind: "error", text: data.error });
    setRows(data.rows);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: string, id: number, decision?: "approved" | "rejected") {
    const comment = decision ? window.prompt("Review note (optional):") ?? "" : undefined;
    const res = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id, decision, comment }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg({ kind: "error", text: data.error });
    setMsg({
      kind: "success",
      text:
        action === "admission.register"
          ? `Student registered with admission number ${data.student.admissionNo}.`
          : `Application marked ${decision}.`,
    });
    void load();
  }

  async function verify(id: number) {
    const res = await fetch(`/api/resources/admissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentsVerified: true, status: "documents_reviewed" }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg({ kind: "error", text: data.error });
    setMsg({ kind: "success", text: "Documents marked as verified." });
    void load();
  }

  return (
    <div>
      <PageHeader
        title="Admission Workflow"
        subtitle="Application submitted → documents reviewed → approved or rejected → student registered → class assigned"
      />
      {msg && (
        <div className="mb-4">
          <Alert kind={msg.kind}>{msg.text}</Alert>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {STAGES.map((s) => (
          <Card key={s} className="text-center">
            <p className="text-xs font-semibold uppercase text-slate-500">{s.replace(/_/g, " ")}</p>
            <p className="mt-1 text-2xl font-bold">{rows.filter((r) => r.status === s).length}</p>
          </Card>
        ))}
      </div>

      <div className="table-wrap">
        {loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState title="No admission applications" message="New applications recorded by the admissions officer appear here." />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Application</th>
                <th>Applicant</th>
                <th>Guardian</th>
                <th>Documents</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">{r.applicationNo}</td>
                  <td className="font-medium">{r.applicantName}</td>
                  <td>
                    {r.guardianName}
                    <span className="block text-xs text-slate-400">{r.guardianPhone}</span>
                  </td>
                  <td>
                    <Badge tone={r.documentsVerified ? "green" : "amber"}>{r.documentsVerified ? "verified" : "pending"}</Badge>
                  </td>
                  <td>
                    <Badge tone={statusTone(r.status)}>{r.status.replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-3 text-xs font-semibold">
                      {!r.documentsVerified && (
                        <button className="text-sky-700 hover:underline" onClick={() => verify(r.id)}>
                          Verify documents
                        </button>
                      )}
                      {["submitted", "documents_reviewed"].includes(r.status) && (
                        <>
                          <button className="text-emerald-700 hover:underline" onClick={() => act("admission.decide", r.id, "approved")}>
                            Approve
                          </button>
                          <button className="text-rose-600 hover:underline" onClick={() => act("admission.decide", r.id, "rejected")}>
                            Reject
                          </button>
                        </>
                      )}
                      {r.status === "approved" && (
                        <button className="text-emerald-700 hover:underline" onClick={() => act("admission.register", r.id)}>
                          Register student
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
