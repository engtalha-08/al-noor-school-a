"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

const DEMO = [
  { label: "Principal", email: "principal@alnoorschool.studentinfo.pk" },
  { label: "Administrator", email: "admin@alnoorschool.studentinfo.pk" },
  { label: "Teacher", email: "teacher@alnoorschool.studentinfo.pk" },
  { label: "Accountant", email: "accountant@alnoorschool.studentinfo.pk" },
  { label: "Receptionist", email: "reception@alnoorschool.studentinfo.pk" },
  { label: "Librarian", email: "library@alnoorschool.studentinfo.pk" },
  { label: "Transport", email: "transport@alnoorschool.studentinfo.pk" },
  { label: "Parent", email: "parent@alnoorschool.studentinfo.pk" },
  { label: "Student", email: "student@alnoorschool.studentinfo.pk" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("principal@alnoorschool.studentinfo.pk");
  const [password, setPassword] = useState("Passw0rd!2024");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Unable to sign in");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="pattern-islamic hidden flex-col justify-between p-10 text-white lg:flex">
        <div className="flex items-center gap-4">
          <Image src="/images/logo.png" alt="School emblem" width={72} height={72} className="rounded-xl bg-white p-1" />
          <div>
            <p className="text-lg font-bold leading-tight">AL NOOR ISLAMIC SCIENCE SCHOOL</p>
            <p className="text-sm text-amber-300">MIRZAPUR</p>
          </div>
        </div>
        <div>
          <h1 className="max-w-md text-3xl font-bold leading-snug">
            A single, secure system for every school operation.
          </h1>
          <p className="mt-4 max-w-md text-sm text-slate-200">
            Students, attendance, examinations, fees, payroll, library, transport and parent communication — with
            role-based access and full audit trails.
          </p>
        </div>
        <div className="text-xs text-slate-300">
          Principal: Muhammad Nafees · 03058480044
          <br />
          alnoorschool.studentinfo.pk (reference domain)
        </div>
      </div>

      <div className="flex items-center justify-center bg-white px-5 py-10 dark:bg-slate-950">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image src="/images/logo.png" alt="School emblem" width={52} height={52} className="rounded-xl" />
            <p className="text-sm font-bold text-slate-800 dark:text-white">AL NOOR ISLAMIC SCIENCE SCHOOL MIRZAPUR</p>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Use the account issued to you by the school office.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
                {error}
              </div>
            )}
            <button className="btn-primary w-full" disabled={loading}>
              {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-8 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sample demo accounts</p>
            <p className="mt-1 text-xs text-slate-400">
              Seeded demonstration data — password <code className="font-mono">Passw0rd!2024</code>. Replace before any
              production pilot.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword("Passw0rd!2024");
                  }}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-emerald-600 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
