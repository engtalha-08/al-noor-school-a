"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Card, EmptyState, Modal, PageHeader, Spinner, statusTone } from "@/components/ui";

type Announcement = {
  id: number;
  title: string;
  body: string;
  audience: string;
  channel: string;
  status: string;
  category: string;
  createdAt: string;
};
type Stat = { announcementId: number; status: string; count: number };
type Delivery = { id: number; recipientType: string; recipientRef: string | null; channel: string; status: string; error: string | null };

const TEMPLATES: Record<string, { title: string; body: string }> = {
  fee_reminder: {
    title: "Fee Reminder",
    body: "Assalamu Alaikum. This is a reminder from AL NOOR ISLAMIC SCIENCE SCHOOL MIRZAPUR that fees for the current month are outstanding. Kindly clear the balance at the school office. JazakAllah.",
  },
  exam_schedule: {
    title: "Examination Schedule",
    body: "Dear Parents, the examination schedule has been announced. Please check the student portal for subject-wise dates and ensure your child's attendance.",
  },
  attendance_alert: {
    title: "Attendance Alert",
    body: "Dear Parent, our records show your child was marked absent today. Kindly inform the class teacher if this is due to illness or an approved leave.",
  },
  result: {
    title: "Result Announcement",
    body: "Dear Parents, examination results have been approved and published. You can now view your child's result card in the parent portal.",
  },
  holiday: {
    title: "School Holiday",
    body: "The school will remain closed on the announced date. Classes will resume as per the normal timetable the following working day.",
  },
  emergency: {
    title: "Emergency Notice",
    body: "Urgent notice from the school administration. Please read carefully and follow the instructions provided.",
  },
};

export default function AnnouncementsPage() {
  const [rows, setRows] = useState<Announcement[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [classes, setClasses] = useState<{ id: number; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [compose, setCompose] = useState(false);
  const [details, setDetails] = useState<{ a: Announcement; rows: Delivery[] } | null>(null);
  const [msg, setMsg] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [settings, setSettings] = useState<{ testMode: boolean; notificationsEnabled: boolean } | null>(null);
  const [providers, setProviders] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/announcements");
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setMsg({ kind: "error", text: data.error });
    setRows(data.rows);
    setStats(data.stats);
  }, []);

  useEffect(() => {
    void load();
    fetch("/api/lookups").then((r) => r.json()).then((d) => setClasses(d.classes ?? [])).catch(() => undefined);
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setSettings(d.settings);
        setProviders(d.providers ?? {});
      })
      .catch(() => undefined);
  }, [load]);

  async function openDeliveries(a: Announcement) {
    const res = await fetch(`/api/announcements/${a.id}/deliveries`);
    const data = await res.json();
    if (!res.ok) return setMsg({ kind: "error", text: data.error });
    setDetails({ a, rows: data.rows });
  }

  const statFor = (id: number, status: string) => stats.find((s) => s.announcementId === id && s.status === status)?.count ?? 0;

  return (
    <div>
      <PageHeader
        title="Notifications & Announcements"
        subtitle="Compose targeted messages, preview the recipient list and track delivery status per recipient."
        actions={
          <button className="btn-primary" onClick={() => setCompose(true)}>
            Compose message
          </button>
        }
      />

      {settings?.testMode && (
        <div className="mb-4">
          <Alert kind="info">
            The school is in <strong>test mode</strong>. External email, SMS and WhatsApp messages are never delivered to real
            parents; they are recorded as <em>skipped</em> with a reason. In-app portal notifications are delivered normally.
            Turn test mode off in System Settings only after the Principal authorises production messaging.
          </Alert>
        </div>
      )}
      {msg && (
        <div className="mb-4">
          <Alert kind={msg.kind}>{msg.text}</Alert>
        </div>
      )}

      <Card className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Configured delivery channels</h2>
        <div className="flex flex-wrap gap-2">
          <Badge tone="green">In-app portal · always available</Badge>
          <Badge tone={providers.email ? "green" : "slate"}>Email {providers.email ? "· configured" : "· SMTP_HOST not set"}</Badge>
          <Badge tone={providers.sms ? "green" : "slate"}>SMS {providers.sms ? "· configured" : "· SMS_API_KEY not set"}</Badge>
          <Badge tone={providers.whatsapp ? "green" : "slate"}>
            WhatsApp {providers.whatsapp ? "· configured" : "· WHATSAPP_TOKEN not set"}
          </Badge>
        </div>
      </Card>

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState title="No messages yet" message="Compose your first announcement to parents, staff or students." />
        </Card>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Title</th>
                <th>Audience</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Delivered</th>
                <th>Skipped / failed</th>
                <th>Sent</th>
                <th className="text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="font-medium">{a.title}</td>
                  <td className="capitalize">{a.audience}</td>
                  <td>{a.channel}</td>
                  <td>
                    <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                  </td>
                  <td>{statFor(a.id, "delivered")}</td>
                  <td>{statFor(a.id, "skipped") + statFor(a.id, "failed")}</td>
                  <td className="text-xs text-slate-500">{new Date(a.createdAt).toLocaleString()}</td>
                  <td className="text-right">
                    <button className="text-xs font-semibold text-emerald-700 hover:underline" onClick={() => openDeliveries(a)}>
                      Delivery report
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {compose && (
        <Composer
          classes={classes}
          onClose={() => setCompose(false)}
          onSent={(note) => {
            setCompose(false);
            setMsg({ kind: "info", text: note });
            void load();
          }}
          onError={(text) => setMsg({ kind: "error", text })}
        />
      )}

      {details && (
        <Modal open title={`Delivery report — ${details.a.title}`} onClose={() => setDetails(null)} wide>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Reference</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {details.rows.map((d) => (
                  <tr key={d.id}>
                    <td className="capitalize">{d.recipientType}</td>
                    <td className="font-mono text-xs">{d.recipientRef}</td>
                    <td>{d.channel}</td>
                    <td>
                      <Badge tone={statusTone(d.status)}>{d.status}</Badge>
                    </td>
                    <td className="max-w-sm truncate text-xs text-slate-500">{d.error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Contact numbers are masked. A parent&apos;s number is never exposed to another parent.
          </p>
        </Modal>
      )}
    </div>
  );
}

function Composer({
  classes,
  onClose,
  onSent,
  onError,
}: {
  classes: { id: number; label: string }[];
  onClose: () => void;
  onSent: (note: string) => void;
  onError: (text: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("parents");
  const [classId, setClassId] = useState("");
  const [channel, setChannel] = useState("in-app");
  const [category, setCategory] = useState("general");
  const [preview, setPreview] = useState<{ recipientCount: number; sample: { name: string; ref: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);

  async function doPreview() {
    setBusy(true);
    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preview", title, body, audience, classId: classId || null, channel }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return onError(data.error);
    setPreview(data);
  }

  async function send() {
    setBusy(true);
    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", title, body, audience, classId: classId || null, channel, category }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return onError(data.error);
    onSent(data.note);
  }

  return (
    <Modal open title="Compose message" onClose={onClose} wide>
      <div className="space-y-4">
        <div>
          <label className="label">Start from a template</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TEMPLATES).map(([k, t]) => (
              <button
                key={k}
                className="btn-ghost text-xs"
                onClick={() => {
                  setTitle(t.title);
                  setBody(t.body);
                  setCategory(k);
                }}
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="aud">Recipient group</label>
            <select id="aud" className="input" value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="parents">All parents / guardians</option>
              <option value="class">Parents of a specific class</option>
              <option value="staff">All staff</option>
              <option value="students">All students</option>
            </select>
          </div>
          {audience === "class" && (
            <div>
              <label className="label" htmlFor="cl">Class</label>
              <select id="cl" className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Select class…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label" htmlFor="ch">Delivery channel</label>
            <select id="ch" className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="in-app">In-app portal notification</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp Business</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="ti">Title</label>
          <input id="ti" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="bo">Message</label>
          <textarea id="bo" className="input min-h-32" value={body} onChange={(e) => setBody(e.target.value)} />
        </div>

        {preview && (
          <Alert kind="info">
            <p className="font-semibold">{preview.recipientCount} recipient(s) will receive this message.</p>
            <p className="mt-1 text-xs">
              Sample: {preview.sample.map((s) => `${s.name} (${s.ref})`).join(", ") || "none"}
            </p>
          </Alert>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-ghost" onClick={doPreview} disabled={busy}>
            Preview recipients
          </button>
          <button className="btn-primary" onClick={send} disabled={busy || !preview}>
            {busy ? "Working…" : "Confirm & send"}
          </button>
        </div>
        <p className="text-right text-xs text-slate-400">Preview the recipient list before sending.</p>
      </div>
    </Modal>
  );
}
