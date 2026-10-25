"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import * as Icons from "lucide-react";
import { navFor, roleLabel } from "@/lib/rbac";

type Props = {
  user: { id: number; name: string; email: string; role: string };
  schoolName: string;
  logoUrl: string;
  children: ReactNode;
};

function Icon({ name, className }: { name: string; className?: string }) {
  const map = Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
  const C = map[name] ?? Icons.Circle;
  return <C className={className} />;
}

export default function Shell({ user, schoolName, logoUrl, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [q, setQ] = useState("");
  const items = navFor(user.role);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function toggleTheme() {
    const el = document.documentElement;
    const dark = el.classList.toggle("dark");
    localStorage.setItem("alnoor-theme", dark ? "dark" : "light");
  }

  function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    const target = ["principal", "admin", "receptionist", "teacher", "accountant"].includes(user.role) ? "/students" : "/dashboard";
    router.push(`${target}?q=${encodeURIComponent(q.trim())}`);
    setOpen(false);
  }

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto px-3 py-4">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            title={item.label}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-emerald-600/15 text-emerald-200 ring-1 ring-emerald-500/40"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon name={item.icon} className="h-4.5 w-4.5 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside
        className={`pattern-islamic hidden shrink-0 flex-col border-r border-white/10 lg:flex ${collapsed ? "w-[76px]" : "w-72"}`}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
          <Image src={logoUrl} alt="School logo" width={40} height={40} className="h-10 w-10 rounded-lg bg-white object-contain p-0.5" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold leading-tight text-white">{schoolName}</p>
              <p className="text-[11px] text-amber-300/90">Management System</p>
            </div>
          )}
        </div>
        {sidebar}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="m-3 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
        >
          {collapsed ? "»" : "« Collapse"}
        </button>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setOpen(false)} />
          <aside className="pattern-islamic absolute left-0 top-0 h-full w-72 animate-fade-up">
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
              <Image src={logoUrl} alt="" width={36} height={36} className="h-9 w-9 rounded-lg bg-white object-contain p-0.5" />
              <p className="text-[13px] font-bold leading-tight text-white">{schoolName}</p>
            </div>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <button className="btn-ghost px-2 py-1.5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Icons.Menu className="h-5 w-5" />
          </button>
          <form onSubmit={search} className="relative hidden flex-1 sm:block">
            <Icons.Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search students, records…"
              className="input max-w-md pl-9"
              aria-label="Global search"
            />
          </form>
          <div className="flex-1 sm:hidden" />
          <button onClick={toggleTheme} className="btn-ghost px-2.5 py-2" aria-label="Toggle theme">
            <Icons.SunMoon className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-1.5 dark:border-slate-800">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight text-slate-800 dark:text-slate-100">{user.name}</p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">{roleLabel(user.role)}</p>
            </div>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-700 text-xs font-bold text-white">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <button onClick={logout} className="btn-ghost px-2.5 py-2" aria-label="Sign out" title="Sign out">
            <Icons.LogOut className="h-4 w-4" />
          </button>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        <footer className="border-t border-slate-200 px-6 py-4 text-center text-xs text-slate-400 dark:border-slate-800">
          {schoolName} · Principal: Muhammad Nafees · 03058480044 · alnoorschool.studentinfo.pk
        </footer>
      </div>
    </div>
  );
}
