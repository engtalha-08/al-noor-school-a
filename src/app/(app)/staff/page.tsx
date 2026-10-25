import { Suspense } from "react";
import ResourcePage from "@/components/resource-page";
import Tabs from "@/components/tabs";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { RESOURCES } from "@/lib/resource-fields";
import { Spinner } from "@/components/ui";

export default async function Page() {
  const user = await getSessionUser();
  const w = (k: string) => can(user?.role, RESOURCES[k].writeCap);
  return (
    <Suspense fallback={<Spinner />}>
      <Tabs
        tabs={[
          { key: "staff", label: "Staff & Teachers", content: <ResourcePage resource="staff" canWrite={w("staff")} /> },
          { key: "teacherAssignments", label: "Teaching Assignments", content: <ResourcePage resource="teacherAssignments" canWrite={w("teacherAssignments")} /> },
        ]}
      />
    </Suspense>
  );
}
