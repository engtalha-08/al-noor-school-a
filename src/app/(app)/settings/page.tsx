"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Alert, Card, PageHeader, Spinner } from "@/components/ui";
import { DEFAULT_GRADING } from "@/lib/grading";

type Settings = Record<string, unknown> & {
  name: string;
  principalName: string;
  principalPhone: string;
  domain: string | null;
  address: string | null;
  email: string | null;
  timings: string | null;
  logoUrl: string | null;
  signatory: string | null;
  senderName: string | null;
  lateFeePerDay: string | null;
  notificationsEnabled: boolean;
  testMode: boolean;
};

const TEXT_FIELDS: { key: keyof Settings; label: string }[] = [
  { key: "name", label: "School name" },
  { key: "principalName", label: "Principal" },
  { key: "principalPhone", label: "Principal contact number" },
  { key: "domain", label: "Domain reference" },
  { key: "email", label: "Official email" },
  { key: "address", label: "School address" },
  { key: "timings", label: "School timings" },
  { key: "logoUrl", label: "Logo URL (upload a file to /public/images and set the path)" },
  { key: "signatory", label: "Authorised signatory (printed on certificates)" },
  { key: "senderName", label: "Notification sender name" },
  { key: "lateFeePerDay", label: "Late fee per day (PKR)" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [providers, setProviders] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setSettings(d.settings);
        setProviders(d.providers ?? {});
      })
      .catch(() => setMsg({ kind: "error", text: "Unable to load settings" }));
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setMsg({ kind: "error", text: data.error });
    setMsg({ kind: "success", text: "School settings updated." });
  }

  if (!settings) return <Spinner label="Loading settings…" />;
  const set = (k: string, v: unknown) => setSettings({ ...settings, [k]: v });

  return (
    <div>
      <PageHeader title="System Settings" subtitle="School identity, branding, academic policy and notification configuration." />
      {msg && (
        <div className="mb-4">
          <Alert kind={msg.kind}>{msg.text}</Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-semibold">School identity</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {TEXT_FIELDS.map((f) => (
              <div key={String(f.key)} className={f.key === "address" ? "sm:col-span-2" : ""}>
                <label className="label" htmlFor={String(f.key)}>{f.label}</label>
                <input
                  id={String(f.key)}
                  className="input"
                  value={String(settings[f.key] ?? "")}
                  onChange={(e) => set(String(f.key), e.target.value)}
                />
              </div>
            ))}
          </div>
          <button className="btn-primary mt-5" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </button>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold">Branding preview</h2>
            <div className="flex items-center gap-3">
              <Image src={settings.logoUrl || "/images/logo.png"} alt="School logo" width={64} height={64} className="rounded-xl border p-1" />
              <div>
                <p className="text-sm font-bold">{settings.name}</p>
                <p className="text-xs text-slate-500">Principal: {settings.principalName}</p>
                <p className="text-xs text-slate-500">{settings.principalPhone}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              To replace the generated placeholder logo, upload the official file to <code>/public/images</code> and set its path
              above.
            </p>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">Notification controls</h2>
            <label className="mb-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.notificationsEnabled} onChange={(e) => set("notificationsEnabled", e.target.checked)} />
              Enable external notification channels
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.testMode} onChange={(e) => set("testMode", e.target.checked)} />
              Test mode (no messages sent to real parents)
            </label>
            <ul className="mt-4 space-y-1 text-xs text-slate-500">
              <li>Email provider: {providers.email ? "configured" : "not configured (SMTP_HOST)"}</li>
              <li>SMS provider: {providers.sms ? "configured" : "not configured (SMS_API_KEY)"}</li>
              <li>WhatsApp Business: {providers.whatsapp ? "configured" : "not configured (WHATSAPP_TOKEN, WHATSAPP_PHONE_ID)"}</li>
            </ul>
            <button className="btn-primary mt-4" onClick={save} disabled={saving}>Save</button>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">Grading policy (default)</h2>
            <table className="w-full text-sm">
              <tbody>
                {DEFAULT_GRADING.map((g) => (
                  <tr key={g.grade}>
                    <td className="py-1 font-semibold">{g.grade}</td>
                    <td className="py-1 text-slate-500">≥ {g.min}%</td>
                    <td className="py-1 text-right text-slate-500">{g.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-slate-400">
              Grades are applied automatically during marks entry. Adjust the policy in <code>src/lib/grading.ts</code> or store
              a custom rule set in the school settings record.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
