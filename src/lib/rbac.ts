export type Role =
  | "principal"
  | "admin"
  | "teacher"
  | "student"
  | "parent"
  | "accountant"
  | "receptionist"
  | "librarian"
  | "transport"
  | "staff";

export const ROLES: { value: Role; label: string }[] = [
  { value: "principal", label: "Principal" },
  { value: "admin", label: "School Administrator" },
  { value: "teacher", label: "Teacher" },
  { value: "student", label: "Student" },
  { value: "parent", label: "Parent / Guardian" },
  { value: "accountant", label: "Accountant" },
  { value: "receptionist", label: "Receptionist / Admissions" },
  { value: "librarian", label: "Librarian" },
  { value: "transport", label: "Transport Manager" },
  { value: "staff", label: "Other Employee" },
];

export const roleLabel = (r: string) => ROLES.find((x) => x.value === r)?.label ?? r;

/** Capability matrix — enforced server side. */
export const CAPABILITIES: Record<string, Role[]> = {
  "students.read": ["principal", "admin", "teacher", "accountant", "receptionist", "librarian", "transport"],
  "students.write": ["principal", "admin", "receptionist"],
  "guardians.read": ["principal", "admin", "teacher", "accountant", "receptionist"],
  "guardians.write": ["principal", "admin", "receptionist"],
  "staff.read": ["principal", "admin"],
  "staff.write": ["principal", "admin"],
  "academics.read": ["principal", "admin", "teacher", "receptionist"],
  "academics.write": ["principal", "admin"],
  "attendance.read": ["principal", "admin", "teacher"],
  "attendance.write": ["principal", "admin", "teacher"],
  "exams.read": ["principal", "admin", "teacher"],
  "exams.write": ["principal", "admin", "teacher"],
  "exams.publish": ["principal"],
  "fees.read": ["principal", "accountant", "admin"],
  "fees.write": ["principal", "accountant"],
  "expenses.read": ["principal", "accountant"],
  "expenses.write": ["principal", "accountant"],
  "payroll.read": ["principal"],
  "payroll.write": ["principal"],
  "admissions.read": ["principal", "admin", "receptionist"],
  "admissions.write": ["principal", "admin", "receptionist"],
  "leaves.read": ["principal", "admin", "teacher"],
  "leaves.approve": ["principal", "admin"],
  "announcements.read": ["principal", "admin", "teacher", "accountant", "receptionist"],
  "announcements.write": ["principal", "admin"],
  "library.read": ["principal", "admin", "librarian", "teacher"],
  "library.write": ["principal", "librarian"],
  "transport.read": ["principal", "admin", "transport"],
  "transport.write": ["principal", "transport"],
  "inventory.read": ["principal", "admin", "staff"],
  "inventory.write": ["principal", "admin"],
  "complaints.read": ["principal", "admin", "teacher"],
  "complaints.write": ["principal", "admin", "teacher", "receptionist"],
  "events.read": ["principal", "admin", "teacher", "receptionist", "student", "parent", "accountant", "librarian", "transport", "staff"],
  "events.write": ["principal", "admin"],
  "users.manage": ["principal"],
  "settings.manage": ["principal"],
  "audit.read": ["principal"],
  "reports.read": ["principal", "admin", "accountant"],
};

export function can(role: string | undefined, cap: string): boolean {
  if (!role) return false;
  const allowed = CAPABILITIES[cap];
  if (!allowed) return false;
  return allowed.includes(role as Role);
}

export type NavItem = { href: string; label: string; icon: string; cap?: string; roles?: Role[] };

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/students", label: "Students", icon: "GraduationCap", cap: "students.read" },
  { href: "/guardians", label: "Parents", icon: "Users", cap: "guardians.read" },
  { href: "/staff", label: "Staff & Teachers", icon: "Briefcase", cap: "staff.read" },
  { href: "/academics", label: "Classes & Subjects", icon: "School", cap: "academics.read" },
  { href: "/timetable", label: "Timetable", icon: "CalendarClock", cap: "academics.read" },
  { href: "/attendance", label: "Attendance", icon: "ClipboardCheck", cap: "attendance.read" },
  { href: "/homework", label: "Homework", icon: "BookOpen", cap: "exams.read" },
  { href: "/exams", label: "Examinations", icon: "FileSpreadsheet", cap: "exams.read" },
  { href: "/fees", label: "Fees & Invoices", icon: "Wallet", cap: "fees.read" },
  { href: "/expenses", label: "Accounts & Expenses", icon: "Receipt", cap: "expenses.read" },
  { href: "/payroll", label: "Payroll", icon: "BadgeDollarSign", cap: "payroll.read" },
  { href: "/admissions", label: "Admissions", icon: "UserPlus", cap: "admissions.read" },
  { href: "/leaves", label: "Leave Requests", icon: "CalendarOff", cap: "leaves.read" },
  { href: "/announcements", label: "Announcements", icon: "Megaphone", cap: "announcements.read" },
  { href: "/library", label: "Library", icon: "Library", cap: "library.read" },
  { href: "/transport", label: "Transport", icon: "Bus", cap: "transport.read" },
  { href: "/inventory", label: "Inventory", icon: "Boxes", cap: "inventory.read" },
  { href: "/complaints", label: "Complaints", icon: "ShieldAlert", cap: "complaints.read" },
  { href: "/events", label: "Calendar & Events", icon: "CalendarDays", cap: "events.read" },
  { href: "/reports", label: "Reports", icon: "BarChart3", cap: "reports.read" },
  { href: "/users", label: "Users & Roles", icon: "UserCog", cap: "users.manage" },
  { href: "/audit", label: "Audit Logs", icon: "ScrollText", cap: "audit.read" },
  { href: "/settings", label: "System Settings", icon: "Settings", cap: "settings.manage" },
  // portals
  { href: "/portal/student", label: "My Portal", icon: "User", roles: ["student"] },
  { href: "/portal/parent", label: "My Children", icon: "Users", roles: ["parent"] },
];

export function navFor(role: string): NavItem[] {
  return NAV.filter((item) => {
    if (item.roles) return item.roles.includes(role as Role);
    if (item.cap) return can(role, item.cap);
    return true;
  });
}
