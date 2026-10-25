import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { Spinner } from "@/components/ui";
import ExamsClient from "./client";

export default async function Page() {
  const user = await getSessionUser();
  return (
    <Suspense fallback={<Spinner />}>
      <ExamsClient canWrite={can(user?.role, "exams.write")} canPublish={can(user?.role, "exams.publish")} />
    </Suspense>
  );
}
