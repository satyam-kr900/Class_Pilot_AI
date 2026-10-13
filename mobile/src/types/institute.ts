/**
 * ClassPilot multi-tenant roles — single platform, shared backend.
 * Owner / teacher / parent / student ko alag permissions + screens milti hain,
 * chaar alag apps nahi banti.
 */

export type InstituteRole = 'owner' | 'teacher' | 'staff' | 'parent' | 'student';

export type Plan = 'free' | 'tutor' | 'growth' | 'pro';

export interface Institute {
  id: string;
  name: string;
  owner_id: string | null;
  plan: Plan;
  created_at: string;
}

export interface InstituteMember {
  id: string;
  institute_id: string;
  user_id: string;
  role: InstituteRole;
  created_at: string;
  institutes?: Institute | null;
}

export interface Batch {
  id: string;
  institute_id: string;
  name: string;
  subject: string | null;
  schedule: string | null;
  created_at: string;
}

export interface FeeInvoice {
  id: string;
  institute_id: string;
  student_id: string;
  amount: number;
  billing_month: string;
  status: 'pending' | 'paid' | 'overdue';
  due_date: string | null;
  created_at: string;
}

export interface Student {
  id: string;
  owner_id: string;
  institute_id: string | null;
  name: string;
  batch: string | null;
  monthly_fee: number;
  guardian_name: string | null;
  guardian_phone: string | null;
  class_name: string | null;
  created_at: string;
}

export function canManage(role: InstituteRole | null): boolean {
  return role === 'owner' || role === 'teacher' || role === 'staff';
}

export function isOwner(role: InstituteRole | null): boolean {
  return role === 'owner';
}
