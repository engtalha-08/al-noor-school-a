import { Suspense } from "react";
import ResourcePage from "@/components/resource-page";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { RESOURCES } from "@/lib/resource-fields";
import { Spinner } from "@/components/ui";

export default async function Page() {
  const user = await getSessionUser();
  const def = RESOURCES["timetable"];
  return (
    <Suspense fallback={<Spinner />}>
      <ResourcePage resource="timetable" canWrite={can(user?.role, def.writeCap)} />
    </Suspense>
  );
}
