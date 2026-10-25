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
          { key: "vehicles", label: "Vehicles", content: <ResourcePage resource="vehicles" canWrite={w("vehicles")} /> },
          { key: "routes", label: "Routes & Stops", content: <ResourcePage resource="routes" canWrite={w("routes")} /> },
          { key: "transportAssignments", label: "Student Transport", content: <ResourcePage resource="transportAssignments" canWrite={w("transportAssignments")} /> },
          { key: "vehicleMaintenance", label: "Maintenance", content: <ResourcePage resource="vehicleMaintenance" canWrite={w("vehicleMaintenance")} /> },
        ]}
      />
    </Suspense>
  );
}
