/**
 * Seeds clearly-labelled SAMPLE data for AL NOOR ISLAMIC SCIENCE SCHOOL MIRZAPUR.
 * Run with:  npx tsx src/db/seed.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db, pool } from "./index";
import * as s from "./schema";

const PASSWORD = "Passw0rd!2024";
const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];

async function main() {
  console.log("Clearing existing data…");
  await db.execute(sql`
    truncate table
      message_deliveries, announcements, notifications, audit_logs,
      results, exam_subjects, exams, homework_submissions, homework,
      payments, invoices, fee_structures, payroll, expenses,
      attendance, staff_attendance, timetable, enrollments, teacher_assignments,
      student_guardians, guardians, students, staff, sections, subjects, classes, academic_years,
      admissions, leave_requests, complaints, book_loans, books,
      transport_assignments, vehicle_maintenance, routes, vehicles, inventory_items, events,
      school_settings, users
    restart identity cascade;
  `);

  const hash = await bcrypt.hash(PASSWORD, 10);

  console.log("School settings…");
  await db.insert(s.schoolSettings).values({
    name: "AL NOOR ISLAMIC SCIENCE SCHOOL MIRZAPUR",
    principalName: "Muhammad Nafees",
    principalPhone: "03058480044",
    domain: "alnoorschool.studentinfo.pk",
    address: "Mirzapur (school address to be confirmed by the administration)",
    email: "info@alnoorschool.studentinfo.pk",
    timings: "08:00 – 14:00 (Monday to Saturday)",
    logoUrl: "/images/logo.png",
    signatory: "Muhammad Nafees, Principal",
    senderName: "AL NOOR SCHOOL",
    lateFeePerDay: "20",
    notificationsEnabled: false,
    testMode: true,
  });

  console.log("Users…");
  const userRows = [
    ["Muhammad Nafees", "principal@alnoorschool.studentinfo.pk", "principal", "03058480044"],
    ["Abdul Rehman", "admin@alnoorschool.studentinfo.pk", "admin", "0300-0000001"],
    ["Hafiz Bilal Ahmed", "teacher@alnoorschool.studentinfo.pk", "teacher", "0300-0000002"],
    ["Saima Yousaf", "teacher2@alnoorschool.studentinfo.pk", "teacher", "0300-0000003"],
    ["Imran Shah", "accountant@alnoorschool.studentinfo.pk", "accountant", "0300-0000004"],
    ["Ayesha Siddiqa", "reception@alnoorschool.studentinfo.pk", "receptionist", "0300-0000005"],
    ["Kamran Aslam", "library@alnoorschool.studentinfo.pk", "librarian", "0300-0000006"],
    ["Zahid Mehmood", "transport@alnoorschool.studentinfo.pk", "transport", "0300-0000007"],
    ["Muhammad Irfan (Parent)", "parent@alnoorschool.studentinfo.pk", "parent", "0300-1111111"],
    ["Hassan Irfan (Student)", "student@alnoorschool.studentinfo.pk", "student", "0300-2222222"],
  ] as const;
  const users = await db
    .insert(s.users)
    .values(userRows.map(([name, email, role, phone]) => ({ name, email, role, phone, passwordHash: hash })))
    .returning();
  const userBy = (email: string) => users.find((u) => u.email === email)!;

  console.log("Academic structure…");
  const [year] = await db
    .insert(s.academicYears)
    .values({ name: "2025–2026", startDate: "2025-04-01", endDate: "2026-03-31", isCurrent: true })
    .returning();
  await db.insert(s.academicYears).values({ name: "2024–2025", startDate: "2024-04-01", endDate: "2025-03-31" });

  const classNames = ["Nursery", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8"];
  const classes = await db
    .insert(s.classes)
    .values(classNames.map((name, i) => ({ name, level: i })))
    .returning();

  const sections = await db
    .insert(s.sections)
    .values(classes.flatMap((c) => [{ classId: c.id, name: "A", room: `Room ${c.level + 1}A`, capacity: 35 }]))
    .returning();

  const subjectNames = ["Islamiyat", "Quran Nazra", "English", "Urdu", "Mathematics", "General Science", "Computer Science", "Social Studies"];
  const subjects = await db
    .insert(s.subjects)
    .values(classes.flatMap((c) => subjectNames.map((n, i) => ({ name: n, code: `${n.slice(0, 3).toUpperCase()}-${c.level}`, classId: c.id }))))
    .returning();

  console.log("Staff…");
  const staffSeed = [
    ["EMP-001", "Muhammad Nafees", "Principal", "M.Phil Education", userBy("principal@alnoorschool.studentinfo.pk").id, 150000],
    ["EMP-002", "Abdul Rehman", "School Administrator", "MBA", userBy("admin@alnoorschool.studentinfo.pk").id, 85000],
    ["EMP-003", "Hafiz Bilal Ahmed", "Senior Teacher", "M.A Islamic Studies", userBy("teacher@alnoorschool.studentinfo.pk").id, 65000],
    ["EMP-004", "Saima Yousaf", "Teacher", "B.Ed, M.Sc Chemistry", userBy("teacher2@alnoorschool.studentinfo.pk").id, 58000],
    ["EMP-005", "Imran Shah", "Accountant", "B.Com", userBy("accountant@alnoorschool.studentinfo.pk").id, 55000],
    ["EMP-006", "Ayesha Siddiqa", "Admission Officer", "B.A", userBy("reception@alnoorschool.studentinfo.pk").id, 42000],
    ["EMP-007", "Kamran Aslam", "Librarian", "M.L.I.S", userBy("library@alnoorschool.studentinfo.pk").id, 40000],
    ["EMP-008", "Zahid Mehmood", "Transport Manager", "F.A", userBy("transport@alnoorschool.studentinfo.pk").id, 45000],
    ["EMP-009", "Nasir Javed", "Teacher", "B.S Mathematics", null, 52000],
    ["EMP-010", "Hira Batool", "Teacher", "B.Ed English", null, 50000],
  ] as const;
  const staff = await db
    .insert(s.staff)
    .values(
      staffSeed.map(([employeeId, fullName, designation, qualification, userId, salary], i) => ({
        employeeId,
        fullName,
        designation,
        qualification,
        userId,
        department: designation.includes("Teacher") ? "Academics" : "Administration",
        phone: `0300-100${String(i).padStart(4, "0")}`,
        email: `${employeeId.toLowerCase()}@alnoorschool.studentinfo.pk`,
        joiningDate: day(-600 + i * 30),
        salary: String(salary),
      })),
    )
    .returning();
  const teachers = staff.filter((x) => x.designation.includes("Teacher"));

  for (const [i, sec] of sections.entries()) {
    await db.update(s.sections).set({ classTeacherId: pick(teachers, i).id }).where(sql`${s.sections.id} = ${sec.id}`);
  }

  console.log("Teaching assignments & timetable…");
  const assignments: (typeof s.teacherAssignments.$inferInsert)[] = [];
  const periods: (typeof s.timetable.$inferInsert)[] = [];
  classes.forEach((c, ci) => {
    const classSubjects = subjects.filter((x) => x.classId === c.id);
    classSubjects.forEach((sub, si) => {
      const t = pick(teachers, ci + si);
      assignments.push({ staffId: t.id, classId: c.id, sectionId: sections[ci].id, subjectId: sub.id, academicYearId: year.id });
      for (let d = 1; d <= 5; d++) {
        if ((si + d) % 3 !== 0) continue;
        periods.push({
          classId: c.id,
          sectionId: sections[ci].id,
          subjectId: sub.id,
          staffId: t.id,
          dayOfWeek: d,
          period: si + 1,
          startTime: `${7 + si}:30`,
          endTime: `${8 + si}:15`,
          room: `Room ${ci + 1}A`,
        });
      }
    });
  });
  await db.insert(s.teacherAssignments).values(assignments);
  await db.insert(s.timetable).values(periods);

  console.log("Students, guardians & enrollments…");
  const first = ["Hassan", "Ahmed", "Fatima", "Ayesha", "Usman", "Bilal", "Zainab", "Maryam", "Hamza", "Ibrahim", "Khadija", "Sumaiya", "Talha", "Anas", "Rabia"];
  const last = ["Irfan", "Khan", "Siddiqui", "Raza", "Aslam", "Mehmood", "Javed", "Farooq", "Nadeem", "Shahid"];
  const studentValues: (typeof s.students.$inferInsert)[] = [];
  let n = 0;
  classes.forEach((c, ci) => {
    const count = 8 + (ci % 4);
    for (let i = 0; i < count; i++) {
      n++;
      studentValues.push({
        admissionNo: `ANS-2025-${String(n).padStart(4, "0")}`,
        fullName: `${pick(first, n + i)} ${pick(last, n)}`,
        classId: c.id,
        sectionId: sections[ci].id,
        academicYearId: year.id,
        gender: n % 2 === 0 ? "Male" : "Female",
        dob: day(-365 * (5 + ci) - (n % 300)),
        admissionDate: day(-(n % 400)),
        status: "active",
        address: `House ${n}, Mohallah Noor, Mirzapur`,
        emergencyContact: `0301-${String(2000000 + n)}`,
        previousSchool: n % 4 === 0 ? "Government Primary School Mirzapur" : null,
      });
    }
  });
  // Demo student account belongs to the first record
  studentValues[0].fullName = "Hassan Irfan";
  studentValues[0].userId = userBy("student@alnoorschool.studentinfo.pk").id;
  const students = await db.insert(s.students).values(studentValues).returning();

  const guardianValues: (typeof s.guardians.$inferInsert)[] = students.map((st, i) => ({
    fullName: i === 0 ? "Muhammad Irfan" : `${pick(last, i)} Sahib`,
    relationship: i !== 0 && i % 5 === 0 ? "Mother" : "Father",
    phone: `0302-${String(3000000 + i)}`,
    email: i % 3 === 0 ? `guardian${i}@example.com` : null,
    address: `House ${i}, Mohallah Noor, Mirzapur`,
    userId: i === 0 ? userBy("parent@alnoorschool.studentinfo.pk").id : null,
    notifySms: true,
  }));
  const guardians = await db.insert(s.guardians).values(guardianValues).returning();

  await db.insert(s.studentGuardians).values(
    students.map((st, i) => ({ studentId: st.id, guardianId: guardians[i].id, isPrimary: true, verified: true })),
  );
  // The demo parent also has a second child (multi-child switching)
  await db.insert(s.studentGuardians).values({ studentId: students[1].id, guardianId: guardians[0].id, isPrimary: true, verified: true });

  await db.insert(s.enrollments).values(
    students.map((st, i) => ({
      studentId: st.id,
      classId: st.classId!,
      sectionId: st.sectionId,
      academicYearId: year.id,
      rollNo: String(i + 1),
    })),
  );

  console.log("Attendance (last 14 school days)…");
  const attendanceRows: (typeof s.attendance.$inferInsert)[] = [];
  for (let d = 14; d >= 0; d--) {
    const date = day(-d);
    if (d !== 0 && new Date(date).getDay() === 0) continue; // Sunday closed
    students.forEach((st, i) => {
      const r = (i * 7 + d * 13) % 100;
      const status = r < 86 ? "present" : r < 93 ? "absent" : r < 97 ? "late" : "leave";
      attendanceRows.push({
        studentId: st.id,
        classId: st.classId,
        sectionId: st.sectionId,
        date,
        session: "full-day",
        status,
        markedBy: userBy("teacher@alnoorschool.studentinfo.pk").id,
      });
    });
  }
  await db.insert(s.attendance).values(attendanceRows);

  await db.insert(s.staffAttendance).values(
    staff.flatMap((st) =>
      [1, 2, 3].map((d) => ({
        staffId: st.id,
        date: day(-d),
        status: (st.id + d) % 11 === 0 ? "absent" : "present",
        checkIn: "07:45",
        checkOut: "14:10",
      })),
    ),
  );

  console.log("Fees, invoices & payments…");
  const feeStructures = await db
    .insert(s.feeStructures)
    .values(
      classes.map((c) => ({
        name: `${c.name} fee structure 2025–2026`,
        classId: c.id,
        academicYearId: year.id,
        tuitionFee: String(1500 + c.level * 250),
        admissionFee: "3000",
        examFee: "500",
        transportFee: "1200",
        otherCharges: "150",
      })),
    )
    .returning();

  const invoiceValues: (typeof s.invoices.$inferInsert)[] = [];
  const periodsToBill = [day(-60).slice(0, 7), day(-30).slice(0, 7), day(0).slice(0, 7)];
  let invSeq = 0;
  periodsToBill.forEach((period) => {
    students.forEach((st) => {
      const fs = feeStructures.find((f) => f.classId === st.classId)!;
      invSeq++;
      invoiceValues.push({
        invoiceNo: `INV-${period.replace("-", "")}-${String(invSeq).padStart(5, "0")}`,
        studentId: st.id,
        period,
        issueDate: `${period}-01`,
        dueDate: `${period}-10`,
        amount: String(Number(fs.tuitionFee) + Number(fs.otherCharges)),
        discount: st.id % 17 === 0 ? "500" : "0",
      });
    });
  });
  const invoices = await db.insert(s.invoices).values(invoiceValues).returning();

  const paymentValues: (typeof s.payments.$inferInsert)[] = [];
  let recSeq = 0;
  invoices.forEach((inv, i) => {
    const payable = Number(inv.amount) - Number(inv.discount);
    const mode = i % 5; // 0,1,2 full · 3 partial · 4 unpaid
    if (mode === 4) return;
    const amount = mode === 3 ? Math.round(payable / 2) : payable;
    recSeq++;
    paymentValues.push({
      receiptNo: `RCPT-2025-${String(recSeq).padStart(6, "0")}`,
      invoiceId: inv.id,
      studentId: inv.studentId,
      amount: String(amount),
      method: pick(["cash", "bank", "easypaisa"], i),
      paidOn: inv.dueDate,
      recordedBy: userBy("accountant@alnoorschool.studentinfo.pk").id,
    });
  });
  await db.insert(s.payments).values(paymentValues);
  for (const inv of invoices) {
    const paid = paymentValues.filter((p) => p.invoiceId === inv.id).reduce((a, b) => a + Number(b.amount), 0);
    const payable = Number(inv.amount) - Number(inv.discount);
    const status = paid >= payable ? "paid" : paid > 0 ? "partial" : "unpaid";
    await db.update(s.invoices).set({ status }).where(sql`${s.invoices.id} = ${inv.id}`);
  }

  console.log("Expenses & payroll…");
  await db.insert(s.expenses).values(
    ["Utilities", "Rent", "Stationery", "Maintenance", "Transport", "Purchase"].flatMap((category, i) =>
      [0, 1, 2].map((m) => ({
        category,
        description: `${category} expense — sample data`,
        amount: String(8000 + i * 2500 + m * 1200),
        spentOn: day(-m * 30 - i),
        vendor: `${category} Supplier ${i + 1}`,
        status: m === 0 ? "pending" : "approved",
      })),
    ),
  );

  await db.insert(s.payroll).values(
    staff.flatMap((st) =>
      [day(-60).slice(0, 7), day(-30).slice(0, 7)].map((period) => {
        const basic = Number(st.salary);
        const allowances = Math.round(basic * 0.1);
        const deductions = Math.round(basic * 0.05);
        return {
          staffId: st.id,
          period,
          basic: String(basic),
          allowances: String(allowances),
          deductions: String(deductions),
          netPay: String(basic + allowances - deductions),
          status: "paid",
          paidOn: `${period}-28`,
        };
      }),
    ),
  );

  console.log("Examinations & results…");
  const exams = await db
    .insert(s.exams)
    .values(
      classes.slice(0, 5).map((c, i) => ({
        name: `${i === 0 ? "First Term" : i === 1 ? "Mid-Term" : "Monthly Test"} — ${c.name}`,
        type: i < 2 ? "Term" : "Monthly",
        classId: c.id,
        academicYearId: year.id,
        startDate: day(i < 2 ? -40 + i : 14 + i),
        endDate: day(i < 2 ? -35 + i : 20 + i),
        status: i < 2 ? "completed" : "scheduled",
      })),
    )
    .returning();

  const examSubjectValues: (typeof s.examSubjects.$inferInsert)[] = [];
  exams.forEach((ex) => {
    subjects
      .filter((su) => su.classId === ex.classId)
      .slice(0, 5)
      .forEach((su, i) => {
        examSubjectValues.push({ examId: ex.id, subjectId: su.id, examDate: day(-38 + i), maxMarks: 100, passMarks: 33 });
      });
  });
  const examSubjects = await db.insert(s.examSubjects).values(examSubjectValues).returning();

  const gradeFor = (p: number) => (p >= 90 ? "A+" : p >= 80 ? "A" : p >= 70 ? "B" : p >= 60 ? "C" : p >= 50 ? "D" : p >= 40 ? "E" : "F");
  const resultValues: (typeof s.results.$inferInsert)[] = [];
  for (const ex of exams.filter((e) => e.status === "completed")) {
    const roster = students.filter((st) => st.classId === ex.classId);
    const papers = examSubjects.filter((p) => p.examId === ex.id);
    roster.forEach((st, si) => {
      papers.forEach((p, pi) => {
        const marks = 38 + ((st.id * 7 + pi * 13 + si) % 58);
        resultValues.push({
          examId: ex.id,
          examSubjectId: p.id,
          studentId: st.id,
          marksObtained: String(marks),
          grade: gradeFor(marks),
          enteredBy: userBy("teacher@alnoorschool.studentinfo.pk").id,
        });
      });
    });
  }
  if (resultValues.length) await db.insert(s.results).values(resultValues);
  await db.update(s.exams).set({ status: "published", publishedAt: new Date() }).where(sql`${s.exams.id} = ${exams[0].id}`);

  console.log("Homework, events, announcements…");
  await db.insert(s.homework).values(
    classes.slice(0, 6).flatMap((c, ci) =>
      [0, 1].map((k) => ({
        title: `${pick(subjectNames, ci + k)} — exercise ${k + 1}`,
        classId: c.id,
        sectionId: sections[ci].id,
        subjectId: subjects.find((su) => su.classId === c.id)!.id,
        staffId: pick(teachers, ci).id,
        dueDate: day(2 + k),
        instructions: "Complete the exercise in your notebook and submit to the class teacher.",
        maxMarks: 10,
      })),
    ),
  );

  await db.insert(s.events).values([
    { title: "Parent–Teacher Meeting", type: "ptm", startDate: day(7), description: "Term progress discussion for all classes." },
    { title: "Eid Holidays", type: "holiday", startDate: day(21), endDate: day(25) },
    { title: "Annual Sports Day", type: "event", startDate: day(35) },
    { title: "Staff Meeting", type: "meeting", startDate: day(3) },
    { title: "Monthly Test Week", type: "exam", startDate: day(14), endDate: day(20) },
  ]);

  const [ann] = await db
    .insert(s.announcements)
    .values({
      title: "Welcome to the new academic session",
      body: "Assalamu Alaikum. Classes for the 2025–2026 session have begun. Parents are requested to check the portal regularly for homework, attendance and fee updates.",
      category: "general",
      audience: "parents",
      channel: "in-app",
      status: "sent",
      sentAt: new Date(),
      createdBy: userBy("principal@alnoorschool.studentinfo.pk").id,
    })
    .returning();
  await db.insert(s.messageDeliveries).values({
    announcementId: ann.id,
    recipientType: "guardian",
    recipientId: guardians[0].id,
    recipientRef: "0302****00",
    channel: "in-app",
    status: "delivered",
  });
  await db.insert(s.notifications).values({
    userId: userBy("parent@alnoorschool.studentinfo.pk").id,
    title: ann.title,
    body: ann.body,
    link: "/portal/parent",
  });

  console.log("Admissions, leave, complaints…");
  await db.insert(s.admissions).values(
    [0, 1, 2, 3].map((i) => ({
      applicationNo: `APP-2025-${String(i + 1).padStart(3, "0")}`,
      applicantName: `${pick(first, i + 3)} ${pick(last, i + 2)}`,
      dob: day(-365 * 6 - i * 40),
      gender: i % 2 ? "Male" : "Female",
      guardianName: `${pick(last, i)} Sahib`,
      guardianPhone: `0303-${String(4000000 + i)}`,
      appliedClassId: classes[i % classes.length].id,
      documentsVerified: i < 2,
      status: i === 0 ? "approved" : i === 1 ? "documents_reviewed" : "submitted",
      previousSchool: "Government Primary School Mirzapur",
    })),
  );

  await db.insert(s.leaveRequests).values([
    { requesterType: "staff", staffId: staff[2].id, leaveType: "Casual", startDate: day(2), endDate: day(3), reason: "Family commitment", status: "pending" },
    { requesterType: "staff", staffId: staff[3].id, leaveType: "Sick", startDate: day(-5), endDate: day(-4), reason: "Fever", status: "approved", approverComment: "Approved. Get well soon." },
    { requesterType: "student", studentId: students[4].id, leaveType: "Emergency", startDate: day(1), endDate: day(2), reason: "Travel with family", status: "pending" },
  ]);

  await db.insert(s.complaints).values([
    { title: "Classroom fan not working", category: "Facility", description: "Fan in Room 3A needs repair.", assignedTo: staff[1].id, status: "open" },
    { title: "Late arrival pattern", category: "Discipline", studentId: students[3].id, description: "Student repeatedly arriving late.", assignedTo: staff[2].id, status: "investigating" },
  ]);

  console.log("Library, transport, inventory…");
  const books = await db
    .insert(s.books)
    .values(
      [
        ["Stories of the Prophets", "Ibn Kathir", "Islamic Studies"],
        ["Basic Mathematics Grade 5", "Oxford", "Mathematics"],
        ["English Grammar Practice", "Raymond Murphy", "Languages"],
        ["Science Encyclopedia", "DK", "Science"],
        ["Urdu Adab", "Ahmed Nadeem", "Languages"],
      ].map(([title, author, category], i) => ({
        title,
        author,
        category,
        isbn: `978-000000${i}`,
        totalCopies: 5 + i,
        availableCopies: 3 + i,
        shelf: `Shelf ${i + 1}`,
      })),
    )
    .returning();

  await db.insert(s.bookLoans).values([
    { bookId: books[0].id, studentId: students[0].id, issuedOn: day(-10), dueDate: day(4), status: "issued" },
    { bookId: books[1].id, studentId: students[2].id, issuedOn: day(-25), dueDate: day(-11), status: "overdue", fine: "100" },
    { bookId: books[2].id, studentId: students[3].id, issuedOn: day(-30), dueDate: day(-16), returnedOn: day(-18), status: "returned" },
  ]);

  const vehicles = await db
    .insert(s.vehicles)
    .values([
      { regNo: "LES-4521", model: "Toyota Hiace", capacity: 18, driverName: "Allah Ditta", driverPhone: "0304-5000001", licenseExpiry: day(300) },
      { regNo: "LEB-7789", model: "Suzuki Bolan", capacity: 10, driverName: "Muhammad Younas", driverPhone: "0304-5000002", licenseExpiry: day(120) },
    ])
    .returning();
  const routes = await db
    .insert(s.routes)
    .values([
      { name: "Route 1 — Mirzapur Bazaar", vehicleId: vehicles[0].id, stops: "Bazaar Chowk, Masjid Road, School", fare: "1200", departTime: "07:00" },
      { name: "Route 2 — Kacha Road", vehicleId: vehicles[1].id, stops: "Kacha Road, Noor Colony, School", fare: "1000", departTime: "07:10" },
    ])
    .returning();
  await db.insert(s.transportAssignments).values(
    students.slice(0, 10).map((st, i) => ({
      studentId: st.id,
      routeId: pick(routes, i).id,
      stop: i % 2 ? "Masjid Road" : "Noor Colony",
      monthlyFee: i % 2 ? "1200" : "1000",
    })),
  );
  await db.insert(s.vehicleMaintenance).values([
    { vehicleId: vehicles[0].id, servicedOn: day(-45), description: "Engine oil and filter change", cost: "9500" },
    { vehicleId: vehicles[1].id, servicedOn: day(-20), description: "Brake pads replacement", cost: "6200" },
  ]);

  await db.insert(s.inventoryItems).values([
    { name: "Student desks", category: "Furniture", quantity: 120, unitCost: "4500", location: "Classrooms", condition: "good", purchasedOn: day(-400) },
    { name: "Desktop computers", category: "Computers", quantity: 12, unitCost: "65000", location: "Computer Lab", condition: "good", purchasedOn: day(-300) },
    { name: "Microscopes", category: "Lab Equipment", quantity: 6, unitCost: "18000", location: "Science Lab", condition: "needs-repair", purchasedOn: day(-500) },
    { name: "Cricket kits", category: "Sports", quantity: 4, unitCost: "9000", location: "Store", condition: "good", purchasedOn: day(-150) },
    { name: "Whiteboard markers (box)", category: "Stationery", quantity: 40, unitCost: "600", location: "Store", condition: "good", purchasedOn: day(-30) },
  ]);

  await db.insert(s.auditLogs).values({
    userName: "system",
    action: "seed",
    entity: "database",
    details: "Sample demonstration data loaded. Replace before production use.",
  });

  console.log(`\nSeed complete. ${students.length} sample students, ${invoices.length} invoices, ${attendanceRows.length} attendance records.`);
  console.log(`Sign in with any demo account using the password: ${PASSWORD}`);
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await pool.end();
    process.exit(1);
  });
