import * as schema from "@/db/schema";
import { RESOURCES, type ResourceDef } from "@/lib/resource-fields";
import type { PgTable } from "drizzle-orm/pg-core";

const TABLES: Record<string, PgTable> = {
  students: schema.students,
  guardians: schema.guardians,
  studentGuardians: schema.studentGuardians,
  staff: schema.staff,
  academicYears: schema.academicYears,
  classes: schema.classes,
  sections: schema.sections,
  subjects: schema.subjects,
  teacherAssignments: schema.teacherAssignments,
  timetable: schema.timetable,
  homework: schema.homework,
  exams: schema.exams,
  examSubjects: schema.examSubjects,
  feeStructures: schema.feeStructures,
  expenses: schema.expenses,
  payroll: schema.payroll,
  admissions: schema.admissions,
  leaveRequests: schema.leaveRequests,
  complaints: schema.complaints,
  books: schema.books,
  bookLoans: schema.bookLoans,
  vehicles: schema.vehicles,
  routes: schema.routes,
  transportAssignments: schema.transportAssignments,
  vehicleMaintenance: schema.vehicleMaintenance,
  inventoryItems: schema.inventoryItems,
  events: schema.events,
};

export function getResource(key: string): { def: ResourceDef; table: PgTable } | null {
  const def = RESOURCES[key];
  const table = TABLES[key];
  if (!def || !table) return null;
  return { def, table };
}

type Row = Record<string, unknown>;

export function coerceBody(def: ResourceDef, body: Row): Row {
  const out: Row = {};
  for (const field of def.fields) {
    if (!(field.name in body)) continue;
    const raw = body[field.name];
    if (raw === "" || raw === undefined || raw === null) {
      if (field.required) continue;
      out[field.name] = null;
      continue;
    }
    switch (field.type) {
      case "number":
      case "ref":
        out[field.name] = Number(raw);
        break;
      case "money":
        out[field.name] = String(raw);
        break;
      case "boolean":
        out[field.name] = raw === true || raw === "true";
        break;
      default:
        out[field.name] = String(raw);
    }
  }
  return out;
}

export function validate(def: ResourceDef, body: Row, partial = false): string[] {
  const errors: string[] = [];
  for (const field of def.fields) {
    if (!field.required) continue;
    if (partial && !(field.name in body)) continue;
    const v = body[field.name];
    if (v === undefined || v === null || v === "") errors.push(`${field.label} is required`);
    if (field.type === "number" || field.type === "ref") {
      if (v !== undefined && v !== null && v !== "" && Number.isNaN(Number(v))) {
        errors.push(`${field.label} must be a number`);
      }
    }
  }
  return errors;
}
