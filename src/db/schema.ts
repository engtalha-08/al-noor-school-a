import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  date,
  numeric,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const ts = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const uts = () => timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();

/* ------------------------------- identity ------------------------------- */

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull(), // principal | admin | teacher | student | parent | accountant | receptionist | librarian | transport | staff
    isActive: boolean("is_active").default(true).notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: ts(),
    updatedAt: uts(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  userName: text("user_name"),
  role: text("role"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  details: text("details"),
  createdAt: ts(),
});

export const schoolSettings = pgTable("school_settings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default("AL NOOR ISLAMIC SCIENCE SCHOOL MIRZAPUR"),
  principalName: text("principal_name").notNull().default("Muhammad Nafees"),
  principalPhone: text("principal_phone").notNull().default("03058480044"),
  domain: text("domain").default("alnoorschool.studentinfo.pk"),
  address: text("address"),
  email: text("email"),
  timings: text("timings"),
  logoUrl: text("logo_url").default("/images/logo.png"),
  signatory: text("signatory"),
  senderName: text("sender_name"),
  gradingRules: jsonb("grading_rules"),
  lateFeePerDay: numeric("late_fee_per_day", { precision: 10, scale: 2 }).default("0"),
  notificationsEnabled: boolean("notifications_enabled").default(false).notNull(),
  testMode: boolean("test_mode").default(true).notNull(),
  updatedAt: uts(),
});

/* ------------------------------- academics ------------------------------ */

export const academicYears = pgTable("academic_years", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  isCurrent: boolean("is_current").default(false).notNull(),
  createdAt: ts(),
});

export const classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  level: integer("level").default(0).notNull(),
  createdAt: ts(),
});

export const sections = pgTable("sections", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").notNull(),
  name: text("name").notNull(),
  room: text("room"),
  classTeacherId: integer("class_teacher_id"),
  capacity: integer("capacity").default(40).notNull(),
  createdAt: ts(),
});

export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code"),
  classId: integer("class_id"),
  createdAt: ts(),
});

/* -------------------------------- people -------------------------------- */

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  admissionNo: text("admission_no").notNull(),
  userId: integer("user_id"),
  fullName: text("full_name").notNull(),
  photoUrl: text("photo_url"),
  dob: date("dob"),
  gender: text("gender"),
  classId: integer("class_id"),
  sectionId: integer("section_id"),
  academicYearId: integer("academic_year_id"),
  admissionDate: date("admission_date"),
  status: text("status").default("active").notNull(), // active | transferred | withdrawn | graduated
  address: text("address"),
  emergencyContact: text("emergency_contact"),
  previousSchool: text("previous_school"),
  medicalNotes: text("medical_notes"),
  createdAt: ts(),
  updatedAt: uts(),
});

export const guardians = pgTable("guardians", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  fullName: text("full_name").notNull(),
  relationship: text("relationship").default("Father").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  address: text("address"),
  language: text("language").default("Urdu"),
  notifySms: boolean("notify_sms").default(true).notNull(),
  notifyEmail: boolean("notify_email").default(false).notNull(),
  notifyWhatsapp: boolean("notify_whatsapp").default(false).notNull(),
  createdAt: ts(),
});

export const studentGuardians = pgTable("student_guardians", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  guardianId: integer("guardian_id").notNull(),
  isPrimary: boolean("is_primary").default(true).notNull(),
  verified: boolean("verified").default(true).notNull(),
});

export const staff = pgTable("staff", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id").notNull(),
  userId: integer("user_id"),
  fullName: text("full_name").notNull(),
  designation: text("designation").notNull(),
  department: text("department"),
  qualification: text("qualification"),
  phone: text("phone"),
  email: text("email"),
  joiningDate: date("joining_date"),
  status: text("status").default("active").notNull(),
  salary: numeric("salary", { precision: 12, scale: 2 }).default("0"),
  createdAt: ts(),
});

export const teacherAssignments = pgTable("teacher_assignments", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull(),
  classId: integer("class_id").notNull(),
  sectionId: integer("section_id"),
  subjectId: integer("subject_id"),
  academicYearId: integer("academic_year_id"),
  createdAt: ts(),
});

export const enrollments = pgTable("enrollments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  classId: integer("class_id").notNull(),
  sectionId: integer("section_id"),
  academicYearId: integer("academic_year_id").notNull(),
  rollNo: text("roll_no"),
  status: text("status").default("enrolled").notNull(),
  createdAt: ts(),
});

/* ------------------------------ attendance ------------------------------ */

export const attendance = pgTable(
  "attendance",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id").notNull(),
    classId: integer("class_id"),
    sectionId: integer("section_id"),
    date: date("date").notNull(),
    session: text("session").default("full-day").notNull(),
    status: text("status").notNull(), // present | absent | late | leave
    remarks: text("remarks"),
    markedBy: integer("marked_by"),
    createdAt: ts(),
  },
  (t) => [uniqueIndex("attendance_unique").on(t.studentId, t.date, t.session)],
);

export const staffAttendance = pgTable(
  "staff_attendance",
  {
    id: serial("id").primaryKey(),
    staffId: integer("staff_id").notNull(),
    date: date("date").notNull(),
    status: text("status").notNull(),
    checkIn: text("check_in"),
    checkOut: text("check_out"),
    remarks: text("remarks"),
    createdAt: ts(),
  },
  (t) => [uniqueIndex("staff_attendance_unique").on(t.staffId, t.date)],
);

/* ------------------------------- timetable ------------------------------ */

export const timetable = pgTable("timetable", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").notNull(),
  sectionId: integer("section_id"),
  subjectId: integer("subject_id"),
  staffId: integer("staff_id"),
  dayOfWeek: integer("day_of_week").notNull(), // 1 = Monday
  period: integer("period").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  room: text("room"),
  createdAt: ts(),
});

/* --------------------------- homework & exams --------------------------- */

export const homework = pgTable("homework", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  classId: integer("class_id").notNull(),
  sectionId: integer("section_id"),
  subjectId: integer("subject_id"),
  staffId: integer("staff_id"),
  dueDate: date("due_date"),
  instructions: text("instructions"),
  attachmentUrl: text("attachment_url"),
  maxMarks: integer("max_marks"),
  createdAt: ts(),
});

export const homeworkSubmissions = pgTable("homework_submissions", {
  id: serial("id").primaryKey(),
  homeworkId: integer("homework_id").notNull(),
  studentId: integer("student_id").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
  content: text("content"),
  marks: integer("marks"),
  feedback: text("feedback"),
});

export const exams = pgTable("exams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").default("Term").notNull(),
  academicYearId: integer("academic_year_id"),
  classId: integer("class_id"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  status: text("status").default("scheduled").notNull(), // scheduled | ongoing | completed | published
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: ts(),
});

export const examSubjects = pgTable("exam_subjects", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull(),
  subjectId: integer("subject_id").notNull(),
  examDate: date("exam_date"),
  maxMarks: integer("max_marks").default(100).notNull(),
  passMarks: integer("pass_marks").default(33).notNull(),
});

export const results = pgTable(
  "results",
  {
    id: serial("id").primaryKey(),
    examId: integer("exam_id").notNull(),
    examSubjectId: integer("exam_subject_id").notNull(),
    studentId: integer("student_id").notNull(),
    marksObtained: numeric("marks_obtained", { precision: 6, scale: 2 }).notNull(),
    grade: text("grade"),
    remarks: text("remarks"),
    enteredBy: integer("entered_by"),
    createdAt: ts(),
    updatedAt: uts(),
  },
  (t) => [uniqueIndex("results_unique").on(t.examSubjectId, t.studentId)],
);

/* ---------------------------------- fees -------------------------------- */

export const feeStructures = pgTable("fee_structures", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  classId: integer("class_id"),
  academicYearId: integer("academic_year_id"),
  tuitionFee: numeric("tuition_fee", { precision: 12, scale: 2 }).default("0").notNull(),
  admissionFee: numeric("admission_fee", { precision: 12, scale: 2 }).default("0").notNull(),
  examFee: numeric("exam_fee", { precision: 12, scale: 2 }).default("0").notNull(),
  transportFee: numeric("transport_fee", { precision: 12, scale: 2 }).default("0").notNull(),
  otherCharges: numeric("other_charges", { precision: 12, scale: 2 }).default("0").notNull(),
  createdAt: ts(),
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNo: text("invoice_no").notNull(),
  studentId: integer("student_id").notNull(),
  period: text("period").notNull(),
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).default("0").notNull(),
  lateFee: numeric("late_fee", { precision: 12, scale: 2 }).default("0").notNull(),
  status: text("status").default("unpaid").notNull(), // unpaid | partial | paid | cancelled
  notes: text("notes"),
  createdAt: ts(),
  updatedAt: uts(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  receiptNo: text("receipt_no").notNull(),
  invoiceId: integer("invoice_id").notNull(),
  studentId: integer("student_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  method: text("method").default("cash").notNull(),
  reference: text("reference"),
  paidOn: date("paid_on").notNull(),
  recordedBy: integer("recorded_by"),
  voided: boolean("voided").default(false).notNull(),
  createdAt: ts(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  description: text("description"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  spentOn: date("spent_on").notNull(),
  vendor: text("vendor"),
  status: text("status").default("pending").notNull(), // pending | approved | rejected
  approvedBy: integer("approved_by"),
  createdAt: ts(),
});

export const payroll = pgTable("payroll", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull(),
  period: text("period").notNull(),
  basic: numeric("basic", { precision: 12, scale: 2 }).notNull(),
  allowances: numeric("allowances", { precision: 12, scale: 2 }).default("0").notNull(),
  deductions: numeric("deductions", { precision: 12, scale: 2 }).default("0").notNull(),
  netPay: numeric("net_pay", { precision: 12, scale: 2 }).notNull(),
  status: text("status").default("draft").notNull(), // draft | approved | paid
  paidOn: date("paid_on"),
  createdAt: ts(),
});

/* ------------------------- admissions & workflows ----------------------- */

export const admissions = pgTable("admissions", {
  id: serial("id").primaryKey(),
  applicationNo: text("application_no").notNull(),
  applicantName: text("applicant_name").notNull(),
  dob: date("dob"),
  gender: text("gender"),
  guardianName: text("guardian_name").notNull(),
  guardianPhone: text("guardian_phone").notNull(),
  appliedClassId: integer("applied_class_id"),
  previousSchool: text("previous_school"),
  documentsVerified: boolean("documents_verified").default(false).notNull(),
  status: text("status").default("submitted").notNull(), // submitted | documents_reviewed | approved | rejected | registered
  reviewNotes: text("review_notes"),
  decidedBy: integer("decided_by"),
  createdAt: ts(),
  updatedAt: uts(),
});

export const leaveRequests = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  requesterType: text("requester_type").notNull(), // staff | student
  staffId: integer("staff_id"),
  studentId: integer("student_id"),
  leaveType: text("leave_type").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  reason: text("reason"),
  status: text("status").default("pending").notNull(), // pending | approved | rejected
  approverComment: text("approver_comment"),
  decidedBy: integer("decided_by"),
  createdAt: ts(),
});

export const complaints = pgTable("complaints", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").default("General").notNull(),
  description: text("description"),
  studentId: integer("student_id"),
  raisedBy: integer("raised_by"),
  assignedTo: integer("assigned_to"),
  sensitive: boolean("sensitive").default(false).notNull(),
  status: text("status").default("open").notNull(), // open | investigating | resolved | closed
  resolutionNotes: text("resolution_notes"),
  createdAt: ts(),
});

/* ----------------------------- communication ---------------------------- */

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category").default("general").notNull(),
  audience: text("audience").default("all").notNull(), // all | parents | staff | students | class
  classId: integer("class_id"),
  channel: text("channel").default("in-app").notNull(), // in-app | email | sms | whatsapp
  status: text("status").default("draft").notNull(), // draft | queued | sent | failed
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdBy: integer("created_by"),
  createdAt: ts(),
});

export const messageDeliveries = pgTable("message_deliveries", {
  id: serial("id").primaryKey(),
  announcementId: integer("announcement_id").notNull(),
  recipientType: text("recipient_type").notNull(), // guardian | staff | student
  recipientId: integer("recipient_id").notNull(),
  recipientRef: text("recipient_ref"),
  channel: text("channel").notNull(),
  status: text("status").default("pending").notNull(), // pending | delivered | failed | skipped
  error: text("error"),
  updatedAt: uts(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  link: text("link"),
  read: boolean("read").default(false).notNull(),
  createdAt: ts(),
});

/* ----------------------- library / transport / assets ------------------- */

export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author"),
  isbn: text("isbn"),
  category: text("category").default("General").notNull(),
  totalCopies: integer("total_copies").default(1).notNull(),
  availableCopies: integer("available_copies").default(1).notNull(),
  shelf: text("shelf"),
  createdAt: ts(),
});

export const bookLoans = pgTable("book_loans", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull(),
  studentId: integer("student_id").notNull(),
  issuedOn: date("issued_on").notNull(),
  dueDate: date("due_date").notNull(),
  returnedOn: date("returned_on"),
  fine: numeric("fine", { precision: 10, scale: 2 }).default("0").notNull(),
  status: text("status").default("issued").notNull(), // issued | returned | overdue
  createdAt: ts(),
});

export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  regNo: text("reg_no").notNull(),
  model: text("model"),
  capacity: integer("capacity").default(20).notNull(),
  driverName: text("driver_name"),
  driverPhone: text("driver_phone"),
  licenseExpiry: date("license_expiry"),
  status: text("status").default("active").notNull(),
  createdAt: ts(),
});

export const routes = pgTable("routes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  vehicleId: integer("vehicle_id"),
  stops: text("stops"),
  fare: numeric("fare", { precision: 10, scale: 2 }).default("0").notNull(),
  departTime: text("depart_time"),
  createdAt: ts(),
});

export const transportAssignments = pgTable("transport_assignments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  routeId: integer("route_id").notNull(),
  stop: text("stop"),
  monthlyFee: numeric("monthly_fee", { precision: 10, scale: 2 }).default("0").notNull(),
  createdAt: ts(),
});

export const vehicleMaintenance = pgTable("vehicle_maintenance", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull(),
  servicedOn: date("serviced_on").notNull(),
  description: text("description"),
  cost: numeric("cost", { precision: 10, scale: 2 }).default("0").notNull(),
  createdAt: ts(),
});

export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").default("Furniture").notNull(),
  quantity: integer("quantity").default(0).notNull(),
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }).default("0").notNull(),
  location: text("location"),
  condition: text("condition").default("good").notNull(),
  purchasedOn: date("purchased_on"),
  createdAt: ts(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").default("event").notNull(), // event | holiday | ptm | exam | meeting
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  description: text("description"),
  createdAt: ts(),
});
