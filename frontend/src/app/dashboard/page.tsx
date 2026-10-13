"use client";
import { useEffect, useState } from "react";
import GlassCard from "@/components/GlassCard";
import MyLearning from "@/components/MyLearning";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import QuickActions from "@/components/QuickActions";
import { supabase } from "@/lib/supabase";
import { monthStart, todayISO, useRequireAuth } from "@/lib/useRequireAuth";
import { getSelectedInstituteId, useInstitute } from "@/lib/useInstitute";

export default function DashboardPage() {
  const { checking } = useRequireAuth();
  const { instituteId, role, loading: roleLoading } = useInstitute();
  const [counts, setCounts] = useState({ students: 0, expected: "₹0", collected: "₹0", attendance: "—" });
  const [insight, setInsight] = useState("Loading...");
  const [backendWarn, setBackendWarn] = useState("");

  useEffect(() => {
    const w = sessionStorage.getItem("cp_backend_warn");
    if (w) {
      setBackendWarn(w);
      sessionStorage.removeItem("cp_backend_warn");
    }
  }, []);

  useEffect(() => {
    if (checking) return;
    (async () => {
      const instituteId = getSelectedInstituteId();
      let sq = supabase.from("students").select("id,monthly_fee");
      if (instituteId) sq = sq.eq("institute_id", instituteId).eq("status", "active");
      const { data: students } = await sq;
      const list = (students ?? []) as { id: string; monthly_fee: number }[];
      const expected = list.reduce((s, r) => s + Number(r.monthly_fee || 0), 0);

      let pq = supabase.from("fee_payments").select("student_id,amount").gte("payment_date", monthStart());
      if (instituteId) pq = pq.eq("institute_id", instituteId);
      const { data: pays } = await pq;
      const payList = (pays ?? []) as { student_id: string; amount: number }[];
      const collected = payList.reduce((s, p) => s + Number(p.amount || 0), 0);
      const paidIds = new Set(payList.map((p) => p.student_id));
      const pending = list.length - paidIds.size;

      let aq = supabase.from("attendance").select("status").eq("attendance_date", todayISO());
      if (instituteId) aq = aq.eq("institute_id", instituteId);
      const { data: att } = await aq;
      const attRows = (att ?? []) as { status: string }[];
      const attText = attRows.length
        ? `${attRows.filter((a) => a.status === "present").length}/${attRows.length}`
        : "—";

      const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
      setCounts({ students: list.length, expected: inr(expected), collected: inr(collected), attendance: attText });
      setInsight(
        pending <= 0 && list.length > 0
          ? "Sab fees clear hai. Great! Kal ka batch schedule check karo."
          : `${pending} students pending hain — kal subah reminder bhejo, recovery ~18% badhti hai.`
      );
    })();
  }, [checking]);

  if (checking || roleLoading) return <div className="glass p-6 text-sm">Checking login...</div>;

  // Student/parent portal — own records only, never owner dashboards.
  if ((role === "student" || role === "parent") && instituteId) {
    return (
      <div className="space-y-4">
        <div className="glass-strong p-6">
          <h1 className="text-2xl font-extrabold">My Learning</h1>
          <p className="text-sm text-slate-500">Attendance, homework, results aur fees — live.</p>
        </div>
        <MyLearning instituteId={instituteId} role={role} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {backendWarn && (
        <div className="rounded-2xl border border-amber-400/60 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
          ⚠️ {backendWarn}
        </div>
      )}
      <div className="glass-strong p-6">
        <h1 className="text-2xl font-extrabold">Namaste, Coach!</h1>
        <p className="text-sm text-slate-500">Aaj ka overview — live Supabase se.</p>
      </div>
      <OnboardingChecklist />
      <QuickActions />
      <div className="grid gap-4 md:grid-cols-4">
        <GlassCard title="Total Students" value={String(counts.students)} subtitle="Active" />
        <GlassCard title="Expected" value={counts.expected} subtitle="Is mahine" accent="#6C63FF" />
        <GlassCard title="Collected" value={counts.collected} subtitle="Is mahine" accent="#DC2626" />
        <GlassCard title="Attendance (aaj)" value={counts.attendance} subtitle="Present/total" accent="#F04F38" />
      </div>
      <div className="glass p-6">
        <h2 className="font-bold">AI Insight</h2>
        <p className="mt-1 text-sm text-slate-600">{insight}</p>
      </div>
    </div>
  );
}
