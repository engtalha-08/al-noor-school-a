"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import ResourcePage from "@/components/resource-page";
import Tabs from "@/components/tabs";
import { Alert, Badge, EmptyState, PageHeader, Spinner, TableSkeleton, statusTone } from "@/components/ui";

type Leave = {
  id: number;
  requesterType: string;
  staffId: number | null;
  studentId: number | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
  approverComment: string | null;
};

export default function LeavesPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Tabs
        tabs={[
          { key: "approvals", label: "Approvals", content: <Approvals /> },
          { key: "all", label: "All Requests", content: <ResourcePage resource="leaveRequests" /> },
        ]}
      />
    </Suspense>
  );
}

function Approvals() {
  const [rows, setRows] = useState<Leave[]>([]);
  const [names, setNames] = useState<{ staff: Record<number, string>; students: Record<number, string> }>({ staff: {}, students: {} });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/resources/leaveRequests?pageSize=100");
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setMsg({ kind: "error", text: data.error });
    setRows(data.rows);
  }, []);

  useEffect(() => {
    void load();
    fetch("/api/lookups")
      .then((r) => r.json())
      .then((d) =>
        setNames({
          staff: Object.fromEntries((d.staff ?? []).map((s: { id: number; label: string }) => [s.id, s.label])),
          students: Object.fromEntries((d.students ?? []).map((s: { id: number; label: string }) => [s.id, s.label])),
        }),
      )
      .catch(() => undefined);
  }, [load]);

  async function decide(id: number, decision: "approved" | "rejected") {
    const comment = window.prompt(`Comment for this ${decision} decision (optional):`) ?? "";
    const snapshot = rows;
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status: decision, approverComment: comment } : x))); // optimistic
    const res = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "leave.decide", id, decision, comment }),
    });
    const data = await res.json();
    if (!res.ok) {
      setRows(snapshot);
      return setMsg({ kind: "error", text: data.error });
    }
    setMsg({ kind: "success", text: `Leave request ${decision}.` });
    void load();
  }

  const pending = rows.filter((r) => r.status === "pending");

  return (
    <div>
      <PageHeader title="Leave Approvals" subtitle={`${pending.length} request(s) awaiting a decision`} />
      {msg && (
        <div className="mb-4">
          <Alert kind={msg.kind}>{msg.text}</Alert>
        </div>
      )}
      <div className="table-wrap">
        {loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState title="No leave requests" message="Staff and student leave requests appear here for the authorised approver." />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Requester</th>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Reason</th>
                <th>Status</th>
                <th className="text-right">Decision</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">
                    {r.requesterType === "staff"
                      ? names.staff[r.staffId ?? 0] ?? "Employee"
                      : names.students[r.studentId ?? 0] ?? "Student"}
                    <span className="block text-xs text-slate-400 capitalize">{r.requesterType}</span>
                  </td>
                  <td>{r.leaveType}</td>
                  <td>{r.startDate}</td>
                  <td>{r.endDate}</td>
                  <td className="max-w-xs truncate">{r.reason ?? "—"}</td>
                  <td>
                    <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                  </td>
                  <td className="text-right">
                    {r.status === "pending" ? (
                      <div className="flex justify-end gap-3 text-xs font-semibold">
                        <button className="text-emerald-700 hover:underline" onClick={() => decide(r.id, "approved")}>
                          Approve
                        </button>
                        <button className="text-rose-600 hover:underline" onClick={() => decide(r.id, "rejected")}>
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">{r.approverComment || "Decided"}</span>
                    )}
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
