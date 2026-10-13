"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { getSelectedInstituteId } from "@/lib/useInstitute";
import { createStudentViaAPI, archiveStudentViaAPI } from "@/lib/api";
import type { Student } from "@/types";

export default function StudentsPage() {
  const { userId, checking } = useRequireAuth();
  const [rows, setRows] = useState<Student[]>([]);
  const [name, setName] = useState("");
  const [batch, setBatch] = useState("");
  const [fee, setFee] = useState("");
  const [parentMobile, setParentMobile] = useState("");
  const [studentMobile, setStudentMobile] = useState("");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const shown = q.trim()
    ? rows.filter((s) => {
        const needle = q.trim().toLowerCase();
        return (
          s.name.toLowerCase().includes(needle) ||
          (s.guardian_phone || "").includes(needle) ||
          (s.student_phone || "").includes(needle)
        );
      })
    : rows;

  async function load() {
    const instituteId = getSelectedInstituteId();
    let q = supabase.from("students").select("*").order("created_at", { ascending: false });
    if (instituteId) q = q.eq("institute_id", instituteId);
    const { data, error } = await q;
    if (!error) setRows((data as Student[]) ?? []);
    else setMsg(error.message);
  }

  useEffect(() => {
    if (!checking) load();
  }, [checking]);

  async function add() {
    if (!userId) {
      setMsg("Pehle login karo — RLS ke liye auth zaroori hai.");
      return;
    }
    const cleanName = name.trim();
    const monthlyFee = Number(fee);
    if (!cleanName) {
      setMsg("Name likho.");
      return;
    }
    if (!fee.trim() || !Number.isFinite(monthlyFee) || monthlyFee < 0) {
      setMsg("Valid monthly fee dalo (0 ya zyada).");
      return;
    }
    setSaving(true);
    setMsg("Saving...");
    const instituteId = getSelectedInstituteId();
    if (!instituteId) {
      setSaving(false);
      setMsg("Institute select karo (upar switcher se). Agar nahi dikh raha to dobara login karo.");
      return;
    }
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expired — dobara login karo.");
      await createStudentViaAPI(token, {
        institute_id: instituteId,
        name: cleanName,
        batch: batch.trim() || null,
        monthly_fee: monthlyFee,
        guardian_phone: parentMobile.trim() || null,
        student_phone: studentMobile.trim() || null,
      });
      setName(""); setBatch(""); setFee(""); setParentMobile(""); setStudentMobile(""); setMsg("Saved!");
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Archive this student? Fee/attendance history preserved rahegi.")) return;
    const instituteId = getSelectedInstituteId();
    if (!instituteId) {
      setMsg("Institute select karo.");
      return;
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setMsg("Session expired — dobara login karo.");
      return;
    }
    try {
      await archiveStudentViaAPI(token, id, instituteId);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Archive failed");
    }
  }

  if (checking) return <div className="glass p-6 text-sm">Checking login...</div>;

  return (
    <div className="space-y-4">
      <div className="glass-strong p-6">
        <h1 className="text-xl font-extrabold">Students ({rows.length})</h1>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input className="glass-input" placeholder="Name *" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="glass-input" placeholder="Batch (e.g. 10th-A)" value={batch} onChange={(e) => setBatch(e.target.value)} />
          <input className="glass-input" placeholder="Monthly fee *" type="number" min="0" value={fee} onChange={(e) => setFee(e.target.value)} />
          <input className="glass-input" placeholder="Parent mobile (10-digit)" inputMode="numeric" value={parentMobile} onChange={(e) => setParentMobile(e.target.value)} />
          <input className="glass-input" placeholder="Student mobile (self, optional)" inputMode="numeric" value={studentMobile} onChange={(e) => setStudentMobile(e.target.value)} />
          <button onClick={add} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? "Saving..." : "＋ Add"}</button>
        </div>
        <input className="glass-input mt-2" placeholder="🔍 Naam ya mobile se dhoondo..." value={q} onChange={(e) => setQ(e.target.value)} />
        {msg && <p className="mt-2 text-xs">{msg}</p>}
      </div>
      <div className="glass p-4">
        {shown.map((s) => (
          <div key={s.id} className="flex items-center justify-between border-b border-white/20 py-3 last:border-0">
            <div>
              <p className="font-bold">{s.name}</p>
              <p className="text-xs text-slate-500">{s.batch || "No batch"} • ₹{s.monthly_fee}/mo</p>
              {(s.guardian_phone || s.student_phone) && (
                <p className="text-xs text-slate-500">📱 {s.guardian_phone ? `P: ${s.guardian_phone}` : ""}{s.guardian_phone && s.student_phone ? " • " : ""}{s.student_phone ? `S: ${s.student_phone}` : ""}</p>
              )}
            </div>
            <button onClick={() => remove(s.id)} className="btn-ghost !px-3 !py-1.5 text-xs">Archive</button>
          </div>
        ))}
        {shown.length === 0 && <p className="py-6 text-center text-sm text-slate-500">{rows.length === 0 ? "Koi student nahi — upar se add karo." : "Koi match nahi — spelling check karo."}</p>}
      </div>
    </div>
  );
}
