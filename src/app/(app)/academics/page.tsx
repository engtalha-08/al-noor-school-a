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
          { key: "academicYears", label: "Academic Years", content: <ResourcePage resource="academicYears" canWrite={w("academicYears")} /> },
          { key: "classes", label: "Classes", content: <ResourcePage resource="classes" canWrite={w("classes")} /> },
          { key: "sections", label: "Sections", content: <ResourcePage resource="sections" canWrite={w("sections")} /> },
          { key: "subjects", label: "Subjects", content: <ResourcePage resource="subjects" canWrite={w("subjects")} /> },
        ]}
      />
    </Suspense>
  );
}
