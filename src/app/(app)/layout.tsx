import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/db";
import { schoolSettings } from "@/db/schema";
import Shell from "@/components/shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  let name = "AL NOOR ISLAMIC SCIENCE SCHOOL MIRZAPUR";
  let logo = "/images/logo.png";
  try {
    const [s] = await db.select().from(schoolSettings).limit(1);
    if (s) {
      name = s.name;
      logo = s.logoUrl ?? logo;
    }
  } catch {
    // settings table not ready yet — fall back to defaults
  }
  return (
    <Shell user={user} schoolName={name} logoUrl={logo}>
      {children}
    </Shell>
  );
}
