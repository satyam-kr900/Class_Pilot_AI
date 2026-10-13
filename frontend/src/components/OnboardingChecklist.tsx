"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getSelectedInstituteId } from "@/lib/useInstitute";

type Step = { done: boolean; label: string; href: string };

/** Naye institute ko 4 steps me live karo. Sab tick → checklist gayab. */
export default function OnboardingChecklist() {
  const [steps, setSteps] = useState<Step[] | null>(null);

  useEffect(() => {
    (async () => {
      const iid = getSelectedInstituteId();
      if (!iid) {
        setSteps(null);
        return;
      }
      const [{ count: st }, { count: ba }, { count: at }, { count: pa }] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("institute_id", iid),
        supabase.from("batches").select("id", { count: "exact", head: true }).eq("institute_id", iid),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("institute_id", iid),
        supabase.from("fee_payments").select("id", { count: "exact", head: true }).eq("institute_id", iid),
      ]);
      const s: Step[] = [
        { done: (st ?? 0) > 0, label: "Pehla student add karo", href: "/dashboard/students" },
        { done: (ba ?? 0) > 0, label: "Pehla batch banao", href: "/dashboard/batches" },
        { done: (at ?? 0) > 0, label: "Pehli attendance lo", href: "/dashboard/attendance" },
        { done: (pa ?? 0) > 0, label: "Pehli fee collect karo", href: "/dashboard/fees" },
      ];
      setSteps(s.every((x) => x.done) ? null : s);
    })();
  }, []);

  if (!steps) return null;
  const done = steps.filter((s) => s.done).length;

  return (
    <div className="glass-strong space-y-2 p-6">
      <p className="font-extrabold">🚀 Setup: {done}/4 complete</p>
      <div className="h-2 overflow-hidden rounded-full bg-white/40">
        <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${(done / 4) * 100}%` }} />
      </div>
      {steps.map((s) => (
        <Link key={s.label} href={s.href} className="flex items-center gap-2 rounded-xl bg-white/30 px-3 py-2 text-sm font-bold hover:bg-white/50">
          <span>{s.done ? "✅" : "⭕"}</span> {s.label} <span className="ml-auto">→</span>
        </Link>
      ))}
    </div>
  );
}
