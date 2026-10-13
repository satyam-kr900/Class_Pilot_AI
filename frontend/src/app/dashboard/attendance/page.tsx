"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { todayISO, useRequireAuth } from "@/lib/useRequireAuth";
import { getSelectedInstituteId } from "@/lib/useInstitute";
import { saveAttendanceViaAPI } from "@/lib/api";

type Row = { id: string; name: string; batch: string | null };

export default function AttendancePage() {
  const { checking } = useRequireAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const date = todayISO();

  async function load() {
    const instituteId = getSelectedInstituteId();
    let sq = supabase.from("students").select("id,name,batch").order("name");
    if (instituteId) sq = sq.eq("institute_id", instituteId).eq("status", "active");
    const { data: s } = await sq;
    const list = ((s as Row[]) ?? []);
    setRows(list);
    let aq = supabase.from("attendance").select("student_id,status").eq("attendance_date", date);
    if (instituteId) aq = aq.eq("institute_id", instituteId);
    const { data: att } = await aq;
    const attList = (att ?? []) as { student_id: string; status: string }[];
    if (attList.length) {
      setPresent(new Set(attList.filter((a) => a.status === "present").map((a) => a.student_id)));
    } else {
      setPresent(new Set(list.map((r) => r.id)));
    }
  }

  useEffect(() => {
    if (!checking) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking]);

  const pct = rows.length ? Math.round((present.size / rows.length) * 100) : 0;

  async function save() {
    const instituteId = getSelectedInstituteId();
    if (!instituteId) {
      setMsg("Institute select karo (upar switcher se).");
      return;
    }
    setSaving(true);
    setMsg("");
    const payload = rows.map((s) => ({
      institute_id: instituteId,
      student_id: s.id,
      attendance_date: date,
      status: present.has(s.id) ? "present" : "absent",
    }));
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expired — dobara login karo.");
      const res = (await saveAttendanceViaAPI(token, payload)) as { saved?: number };
      setMsg(`Saved ${res.saved ?? present.size}/${rows.length} (${date})`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (checking) return <div className="glass p-6 text-sm">Checking login...</div>;

  return (
    <div className="space-y-4">
      <div className="glass-strong flex items-center justify-between p-6">
        <div>
          <h1 className="text-xl font-extrabold">Attendance — {date}</h1>
          <p className="text-sm text-slate-500">{present.size}/{rows.length} present • {pct}%</p>
        </div>
        <span className="chip">{pct}%</span>
      </div>
      {msg && <p className="text-xs">{msg}</p>}
      <div className="glass p-4">
        {rows.map((s) => (
          <div key={s.id} className="flex items-center justify-between border-b border-white/20 py-3 last:border-0">
            <div>
              <p className="font-bold">{s.name}</p>
              <p className="text-xs text-slate-500">{s.batch || "No batch"}</p>
            </div>
            <button
              onClick={() => setPresent((prev) => {
                const n = new Set(prev);
                if (n.has(s.id)) n.delete(s.id);
                else n.add(s.id);
                return n;
              })}
              className={`rounded-full px-4 py-1.5 text-xs font-bold ${present.has(s.id) ? "bg-red-500 text-white" : "bg-red-100 text-red-600"}`}
            >
              {present.has(s.id) ? "Present" : "Absent"}
            </button>
          </div>
        ))}
        {rows.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Pehle students add karo.</p>}
      </div>
      <button onClick={save} disabled={saving || rows.length === 0} className="btn-primary w-full disabled:opacity-50">
        {saving ? "Saving..." : `Save Attendance (${present.size}/${rows.length})`}
      </button>
    </div>
  );
}
