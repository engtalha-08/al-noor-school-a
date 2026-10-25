"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RESOURCES, type Field } from "@/lib/resource-fields";
import {
  Alert,
  Badge,
  Confirm,
  EmptyState,
  Modal,
  PageHeader,
  TableSkeleton,
  downloadCsv,
  money,
  statusTone,
} from "@/components/ui";

type Row = Record<string, unknown>;
type Lookups = Record<string, { id: number; label: string }[]>;

export default function ResourcePage({
  resource,
  title,
  subtitle,
  canWrite = true,
  extraActions,
}: {
  resource: string;
  title?: string;
  subtitle?: string;
  canWrite?: boolean;
  extraActions?: React.ReactNode;
}) {
  const def = RESOURCES[resource];
  const params = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState(params.get("q") ?? "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lookups, setLookups] = useState<Lookups>({});
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  const listFields = useMemo(() => def.fields.filter((f) => f.list !== false), [def]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/resources/${resource}?q=${encodeURIComponent(q)}&page=${page}&pageSize=20`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Unable to load records");
      return;
    }
    setError(null);
    setRows(data.rows);
    setTotal(data.total);
  }, [resource, q, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    fetch("/api/lookups")
      .then((r) => (r.ok ? r.json() : {}))
      .then(setLookups)
      .catch(() => undefined);
  }, []);

  const refLabel = (field: Field, value: unknown) => {
    if (value == null) return "—";
    const list = lookups[field.ref ?? ""] ?? [];
    return list.find((o) => o.id === Number(value))?.label ?? `#${value}`;
  };

  function renderCell(field: Field, row: Row) {
    const v = row[field.name];
    if (v === null || v === undefined || v === "") return <span className="text-slate-400">—</span>;
    if (field.type === "ref") return refLabel(field, v);
    if (field.type === "boolean") return <Badge tone={v ? "green" : "slate"}>{v ? "Yes" : "No"}</Badge>;
    if (field.type === "money") return money(v as string);
    if (field.name === "status" || field.name === "condition")
      return <Badge tone={statusTone(String(v))}>{String(v).replace(/_/g, " ")}</Badge>;
    return String(v);
  }

  async function save(form: Row) {
    setSaving(true);
    setError(null);
    const isEdit = Boolean(editing);
    const url = isEdit ? `/api/resources/${resource}/${editing!.id}` : `/api/resources/${resource}`;
    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Save failed");
      return;
    }
    setNotice(isEdit ? `${def.singular} updated successfully.` : `${def.singular} created successfully.`);
    setEditing(null);
    setCreating(false);
    void load();
  }

  async function doDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    const snapshot = rows;
    setRows((r) => r.filter((x) => x.id !== target.id)); // optimistic
    const res = await fetch(`/api/resources/${resource}/${target.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setRows(snapshot);
      setError(data.error ?? "Delete failed");
      return;
    }
    setNotice(`${def.singular} deleted.`);
    void load();
  }

  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <div>
      <PageHeader
        title={title ?? def.label}
        subtitle={subtitle ?? `${total} record${total === 1 ? "" : "s"} stored`}
        actions={
          <>
            {extraActions}
            <button className="btn-ghost" onClick={() => downloadCsv(`${resource}.csv`, rows as Record<string, unknown>[])}>
              Export CSV
            </button>
            {canWrite && (
              <button className="btn-primary" onClick={() => setCreating(true)}>
                + New {def.singular}
              </button>
            )}
          </>
        }
      />

      {notice && (
        <div className="mb-4">
          <Alert kind="success">{notice}</Alert>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      {def.searchFields.length > 0 && (
        <div className="mb-4 flex gap-2">
          <input
            className="input max-w-sm"
            placeholder={`Search ${def.label.toLowerCase()}…`}
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            aria-label="Search"
          />
        </div>
      )}

      <div className="table-wrap">
        {loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState
            title={`No ${def.label.toLowerCase()} yet`}
            message={q ? "No records match your search. Try a different keyword." : `Create the first ${def.singular.toLowerCase()} to get started.`}
            action={
              canWrite ? (
                <button className="btn-primary mt-2" onClick={() => setCreating(true)}>
                  + New {def.singular}
                </button>
              ) : undefined
            }
          />
        ) : (
          <table className="data">
            <thead>
              <tr>
                {listFields.map((f) => (
                  <th key={f.name}>{f.label}</th>
                ))}
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)}>
                  {listFields.map((f) => (
                    <td key={f.name}>{renderCell(f, row)}</td>
                  ))}
                  <td className="text-right">
                    {canWrite ? (
                      <div className="flex justify-end gap-2">
                        <button className="text-xs font-semibold text-emerald-700 hover:underline" onClick={() => setEditing(row)}>
                          Edit
                        </button>
                        <button className="text-xs font-semibold text-rose-600 hover:underline" onClick={() => setDeleting(row)}>
                          Delete
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Read only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            <button className="btn-ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <button className="btn-ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </div>
      )}

      <RecordForm
        open={creating || Boolean(editing)}
        title={editing ? `Edit ${def.singular}` : `New ${def.singular}`}
        fields={def.fields.filter((f) => f.form !== false)}
        lookups={lookups}
        initial={editing ?? {}}
        saving={saving}
        onCancel={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSave={save}
      />

      <Confirm
        open={Boolean(deleting)}
        title={`Delete ${def.singular}?`}
        message="This permanently removes the record. Historical linked records may be affected. This action is written to the audit log."
        confirmLabel="Delete record"
        onCancel={() => setDeleting(null)}
        onConfirm={doDelete}
      />
    </div>
  );
}

export function RecordForm({
  open,
  title,
  fields,
  lookups,
  initial,
  saving,
  onCancel,
  onSave,
}: {
  open: boolean;
  title: string;
  fields: Field[];
  lookups: Lookups;
  initial: Row;
  saving: boolean;
  onCancel: () => void;
  onSave: (v: Row) => void;
}) {
  const [form, setForm] = useState<Row>(initial);
  useEffect(() => setForm(initial), [initial, open]);
  if (!open) return null;

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal open={open} title={title} onClose={onCancel} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
        }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {fields.map((f) => {
          const v = form[f.name];
          const id = `field-${f.name}`;
          return (
            <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
              <label className="label" htmlFor={id}>
                {f.label}
                {f.required && <span className="text-rose-500"> *</span>}
              </label>
              {f.type === "textarea" ? (
                <textarea id={id} className="input min-h-24" value={String(v ?? "")} onChange={(e) => set(f.name, e.target.value)} />
              ) : f.type === "select" ? (
                <select id={id} className="input" value={String(v ?? "")} required={f.required} onChange={(e) => set(f.name, e.target.value)}>
                  <option value="">Select…</option>
                  {f.options?.map((o) => (
                    <option key={o} value={o}>
                      {o.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              ) : f.type === "ref" ? (
                <select id={id} className="input" value={String(v ?? "")} required={f.required} onChange={(e) => set(f.name, e.target.value)}>
                  <option value="">Select…</option>
                  {(lookups[f.ref ?? ""] ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "boolean" ? (
                <label className="flex items-center gap-2 pt-1 text-sm text-slate-600 dark:text-slate-300">
                  <input id={id} type="checkbox" checked={Boolean(v)} onChange={(e) => set(f.name, e.target.checked)} className="h-4 w-4" />
                  Enabled
                </label>
              ) : (
                <input
                  id={id}
                  className="input"
                  required={f.required}
                  type={f.type === "number" || f.type === "money" ? "number" : f.type === "date" ? "date" : "text"}
                  step={f.type === "money" ? "0.01" : undefined}
                  value={String(v ?? "")}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              )}
            </div>
          );
        })}
        <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
