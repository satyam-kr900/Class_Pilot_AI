export type Student = {
  id: string;
  owner_id: string;
  institute_id?: string | null;
  admission_no?: string | null;
  status?: string;
  name: string;
  batch: string | null;
  monthly_fee: number;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  student_phone?: string | null;
  created_at: string;
};

export type FeePayment = {
  id: string;
  owner_id: string;
  student_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  note: string | null;
  created_at: string;
};

export type AttendanceRow = {
  id: string;
  owner_id: string;
  student_id: string;
  attendance_date: string;
  status: "present" | "absent" | "late";
  created_at: string;
};
