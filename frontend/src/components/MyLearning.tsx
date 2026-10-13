"use client";
import { supabase } from "@/lib/supabase";
import { myLearningViaAPI } from "@/lib/api";

type Props = { instituteId: string; role: string };

export default function MyLearning({ instituteId, role }: Props) {
  return <MyLearningInner instituteId={instituteId} role={role} />;
}

import { useEffect, useState } from "react";

function MyLearningInner({ instituteId, role }: Props) {
  const [data, setData] = useState<{ linked: Linked[]; note?: string } | null>(null);
  const [msg, setMsg] = useState("Loading your learning...");

  useEffect(() => {
    (async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        const t = s.session?.access_token;
        if (!t) throw new Error("Session expired.");
        const res = (await myLearningViaAPI(t, instituteId)) as { linked: Linked[]; note?: string };
        setData(res);
        setMsg("");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Load failed");
      }
    })();
  }, [instituteId]);

  if (msg) return <div className="glass p-6 text-sm">{msg}</div>;
  if (!data || data.linked.length === 0)
    return <div className="glass p-6 text-sm">{data?.note ?? "No linked student."}</div>;

  return (
    <div className="space-y-4">
      {data.linked.map((l, i) => (
        <div key={i} className="glass-strong space-y-3 p-6">
          <h2 className="text-xl font-extrabold">{l.student?.name ?? "Student"}</h2>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="glass p-4">
              <p className="text-xs text-slate-500">Attendance</p>
              <p className="text-2xl font-extrabold">
                {l.attendance.pct === null ? "—" : `${l.attendance.pct}%`}
              </p>
              <p className="text-xs">{l.attendance.present}/{l.attendance.total} present</p>
            </div>
            <div className="glass p-4">
              <p className="text-xs text-slate-500">Homework pending</p>
              <p className="text-2xl font-extrabold">{l.homework.pending.length}</p>
            </div>
            <div className="glass p-4">
              <p className="text-xs text-slate-500">Results (published)</p>
              <p className="text-2xl font-extrabold">{l.results.length}</p>
            </div>
            <div className="glass p-4">
              <p className="text-xs text-slate-500">Fee due</p>
              <p className="text-2xl font-extrabold">₹{l.fees.due}</p>
            </div>
          </div>
          {l.homework.pending.length > 0 && (
            <div>
              <p className="text-sm font-bold">Pending homework</p>
              {l.homework.pending.map((h) => (
                <p key={h.id} className="text-sm">• {h.title} (due {h.due_date || "—"})</p>
              ))}
            </div>
          )}
          {role === "parent" && <p className="text-xs text-slate-500">Parent view — records read-only.</p>}
        </div>
      ))}
    </div>
  );
}

type Linked = {
  student: { name?: string };
  attendance: { present: number; total: number; pct: number | null };
  homework: { pending: { id: string; title: string; due_date: string | null }[] };
  results: unknown[];
  fees: { due: number };
};
