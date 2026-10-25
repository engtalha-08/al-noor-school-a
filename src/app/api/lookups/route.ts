import { db } from "@/db";
import { asc } from "drizzle-orm";
import {
  classes,
  sections,
  subjects,
  students,
  staff,
  guardians,
  academicYears,
  exams,
  routes,
  vehicles,
  books,
} from "@/db/schema";
import { requireUser, errorResponse } from "@/lib/auth";

export async function GET() {
  try {
    await requireUser();
    const [cls, sec, sub, stu, stf, grd, yrs, exm, rts, veh, bks] = await Promise.all([
      db.select().from(classes).orderBy(asc(classes.level)),
      db.select().from(sections).orderBy(asc(sections.name)),
      db.select().from(subjects).orderBy(asc(subjects.name)),
      db.select().from(students).orderBy(asc(students.fullName)).limit(2000),
      db.select().from(staff).orderBy(asc(staff.fullName)),
      db.select().from(guardians).orderBy(asc(guardians.fullName)).limit(2000),
      db.select().from(academicYears).orderBy(asc(academicYears.name)),
      db.select().from(exams).orderBy(asc(exams.name)),
      db.select().from(routes).orderBy(asc(routes.name)),
      db.select().from(vehicles).orderBy(asc(vehicles.regNo)),
      db.select().from(books).orderBy(asc(books.title)).limit(1000),
    ]);

    const classMap = new Map(cls.map((c) => [c.id, c.name]));
    return Response.json({
      classes: cls.map((c) => ({ id: c.id, label: c.name })),
      sections: sec.map((s) => ({ id: s.id, label: `${classMap.get(s.classId) ?? "Class"} - ${s.name}` })),
      subjects: sub.map((s) => ({ id: s.id, label: s.classId ? `${s.name} (${classMap.get(s.classId) ?? ""})` : s.name })),
      students: stu.map((s) => ({ id: s.id, label: `${s.fullName} (${s.admissionNo})` })),
      staff: stf.map((s) => ({ id: s.id, label: `${s.fullName} — ${s.designation}` })),
      guardians: grd.map((g) => ({ id: g.id, label: `${g.fullName} (${g.phone})` })),
      academicYears: yrs.map((y) => ({ id: y.id, label: y.name })),
      exams: exm.map((e) => ({ id: e.id, label: e.name })),
      routes: rts.map((r) => ({ id: r.id, label: r.name })),
      vehicles: veh.map((v) => ({ id: v.id, label: v.regNo })),
      books: bks.map((b) => ({ id: b.id, label: b.title })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
