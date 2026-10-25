import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import DashboardClient from "./client";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "student") redirect("/portal/student");
  if (user.role === "parent") redirect("/portal/parent");
  return <DashboardClient user={user} />;
}
