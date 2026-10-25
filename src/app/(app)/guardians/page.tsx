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
          { key: "guardians", label: "Guardians", content: <ResourcePage resource="guardians" canWrite={w("guardians")} /> },
          { key: "studentGuardians", label: "Parent–Student Links", content: <ResourcePage resource="studentGuardians" canWrite={w("studentGuardians")} /> },
        ]}
      />
    </Suspense>
  );
}
