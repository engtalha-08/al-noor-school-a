"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, EmptyState, Modal, PageHeader, TableSkeleton } from "@/components/ui";
import { ROLES, roleLabel } from "@/lib/rbac";

type User = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
};

export default function UsersPage() {
  const [rows, setRows] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [create, setCreate] = useState(false);
  const [resetFor, setResetFor] = useState<User | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/users?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setMsg({ kind: "error", text: data.error });
    setRows(data.rows);
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>, successText: string) {
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return setMsg({ kind: "error", text: data.error });
    setMsg({ kind: "success", text: successText });
    void load();
  }

  return (
    <div>
      <PageHeader
        title="Users, Roles & Permissions"
        subtitle="Permissions are enforced on the server for every API request — hiding a button is never the only control."
        actions={
          <button className="btn-primary" onClick={() => setCreate(true)}>
            + New user account
          </button>
        }
      />

      {msg && (
        <div className="mb-4">
          <Alert kind={msg.kind}>{msg.text}</Alert>
        </div>
      )}

      <input className="input mb-4 max-w-sm" placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="table-wrap">
        {loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState title="No user accounts" message="Create accounts for staff, parents and students." />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last login</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.name}</td>
                  <td className="text-xs">{u.email}</td>
                  <td>
                    <select
                      className="input py-1 text-xs"
                      value={u.role}
                      onChange={(e) => patch({ id: u.id, role: e.target.value }, `${u.name} is now ${roleLabel(e.target.value)}.`)}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <Badge tone={u.isActive ? "green" : "red"}>{u.isActive ? "active" : "deactivated"}</Badge>
                  </td>
                  <td className="text-xs text-slate-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "never"}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-3 text-xs font-semibold">
                      <button className="text-emerald-700 hover:underline" onClick={() => setResetFor(u)}>
                        Reset password
                      </button>
                      <button
                        className="text-rose-600 hover:underline"
                        onClick={() => patch({ id: u.id, isActive: !u.isActive }, `${u.name} ${u.isActive ? "deactivated" : "reactivated"}.`)}
                      >
                        {u.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {create && (
        <CreateUser
          onClose={() => setCreate(false)}
          onDone={(text) => {
            setCreate(false);
            setMsg({ kind: "success", text });
            void load();
          }}
          onError={(text) => setMsg({ kind: "error", text })}
        />
      )}

      {resetFor && (
        <ResetPassword
          user={resetFor}
          onClose={() => setResetFor(null)}
          onDone={(pw) => {
            setResetFor(null);
            void patch({ id: resetFor.id, password: pw }, `Password reset for ${resetFor.name}.`);
          }}
        />
      )}
    </div>
  );
}

function CreateUser({ onClose, onDone, onError }: { onClose: () => void; onDone: (t: string) => void; onError: (t: string) => void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "teacher", phone: "" });
  const [busy, setBusy] = useState(false);
  return (
    <Modal open title="Create user account" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const res = await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });
          const data = await res.json();
          setBusy(false);
          if (!res.ok) return onError(data.error);
          onDone(`Account created for ${form.name}.`);
        }}
      >
        {(["name", "email", "phone"] as const).map((k) => (
          <div key={k}>
            <label className="label capitalize" htmlFor={k}>{k}</label>
            <input id={k} className="input" required={k !== "phone"} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </div>
        ))}
        <div>
          <label className="label" htmlFor="role">Role</label>
          <select id="role" className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="pw">Temporary password (min 8 characters)</label>
          <input id="pw" className="input" minLength={8} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>Create account</button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPassword({ user, onClose, onDone }: { user: User; onClose: () => void; onDone: (pw: string) => void }) {
  const [pw, setPw] = useState("");
  return (
    <Modal open title={`Reset password — ${user.name}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onDone(pw);
        }}
      >
        <p className="text-sm text-slate-500">
          Share the new password with the user through a secure channel and ask them to change it after signing in.
        </p>
        <input className="input" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary">Reset password</button>
        </div>
      </form>
    </Modal>
  );
}
