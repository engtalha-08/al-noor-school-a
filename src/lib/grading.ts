export type GradeRule = { grade: string; min: number; remarks: string };

export const DEFAULT_GRADING: GradeRule[] = [
  { grade: "A+", min: 90, remarks: "Outstanding" },
  { grade: "A", min: 80, remarks: "Excellent" },
  { grade: "B", min: 70, remarks: "Very Good" },
  { grade: "C", min: 60, remarks: "Good" },
  { grade: "D", min: 50, remarks: "Satisfactory" },
  { grade: "E", min: 40, remarks: "Needs Improvement" },
  { grade: "F", min: 0, remarks: "Fail" },
];

export function gradeFor(percentage: number, rules: GradeRule[] = DEFAULT_GRADING) {
  const sorted = [...rules].sort((a, b) => b.min - a.min);
  return sorted.find((r) => percentage >= r.min) ?? sorted[sorted.length - 1];
}
