"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Card, EmptyState, PageHeader, Spinner, downloadCsv } from "@/components/ui";

const TYPES = [
  { key: "enrollment", label: "Enrollment" },
  { key: "attendance", label: "Attendance" },
  { key: "feeCollection", label: "Fee collection" },
  { key: "outstanding", label: "Outstanding balances" },
  { key: "expenses", label: "Expenses" },
  { key: "payroll", label: "Payroll" },
  { key: "teacherWorkload", label: "Teacher workload" },
  { key: "academic", label: "Academic performance" },
  { key: "library", label: "Library" },
  { key: "transport", label: "Transport" },
  { key: "inventory", label: "Inventory" },
];

export default function ReportsPage() {
  const [type, setType] = useState("enrollment");
  const [from, setFrom] = useState(new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/reports?type=${type}&from=${from}&to=${to}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setRows([]);
      setError(data.error);
      return;
    }
    setRows(data.rows);
  }, [type, from, to]);

  useEffect(() => {
    void run();
  }, [run]);

  const cols = rows.length ? Object.keys(rows[0]) : [];

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Filter by report type and date range. Exports are generated from live database records."
        actions={
          <button className="btn-ghost" disabled={!rows.length} onClick={() => downloadCsv(`${type}-report.csv`, rows)}>
            Export CSV / Excel
          </button>
        }
      />

      <Card className="mb-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label" htmlFor="ty">Report</label>
            <select id="ty" className="input" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="fr">From</label>
            <input id="fr" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="to">To</label>
            <input id="to" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full" onClick={run}>Run report</button>
          </div>
        </div>
      </Card>

      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <div className="table-wrap">
        {loading ? (
          <Spinner label="Running report…" />
        ) : rows.length === 0 ? (
          <EmptyState title="No data for this report" message="Try a different report type or widen the date range." />
        ) : (
          <table className="data">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c}>{c.replace(/([A-Z])/g, " $1").trim()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {cols.map((c) => (
                    <td key={c}>{String(r[c] ?? "—")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
