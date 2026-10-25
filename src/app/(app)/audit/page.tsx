"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, EmptyState, PageHeader, TableSkeleton, downloadCsv } from "@/components/ui";

type Log = {
  id: number;
  userName: string | null;
  role: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
};

export default function AuditPage() {
  const [rows, setRows] = useState<Log[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/audit?q=${encodeURIComponent(q)}&page=${page}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error);
    setRows(data.rows);
  }, [q, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle="Every administrative and financial operation is recorded with the acting user, timestamp and entity."
        actions={
          <button className="btn-ghost" onClick={() => downloadCsv("audit-log.csv", rows as unknown as Record<string, unknown>[])}>
            Export CSV
          </button>
        }
      />
      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}
      <input className="input mb-4 max-w-sm" placeholder="Search action, entity or user…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
      <div className="table-wrap">
        {loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState title="No audit entries" message="Administrative actions will appear here as staff use the system." />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Reference</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td className="text-xs text-slate-500">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="font-medium">{l.userName ?? "system"}</td>
                  <td>{l.role && <Badge tone="slate">{l.role}</Badge>}</td>
                  <td>{l.action.replace(/_/g, " ")}</td>
                  <td>{l.entity}</td>
                  <td className="font-mono text-xs">{l.entityId ?? "—"}</td>
                  <td className="max-w-md truncate text-xs text-slate-500">{l.details ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
        <button className="btn-ghost" disabled={rows.length < 50} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </div>
  );
}
