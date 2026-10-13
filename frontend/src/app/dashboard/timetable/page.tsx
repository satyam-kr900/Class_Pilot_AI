"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { getSelectedInstituteId } from "@/lib/useInstitute";
import { createSessionViaAPI, listBatchesViaAPI, listSessionsViaAPI } from "@/lib/api";

type Batch = { id: string; name: string };
type Session = { id: string; title: string; subject: string | null; batch_id: string; starts_at: string; ends_at: string; status: string };

export default function TimetablePage() {
  const { checking } = useRequireAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [form, setForm] = useState({ batch_id: "", title: "", date: new Date().toISOString().slice(0, 10), start: "10:00", end: "11:00" });
  const [msg, setMsg] = useState("");

  async function token() {
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token;
    if (!t) throw new Error("Session expired.");
    return t;
  }

  async function load() {
    const iid = getSelectedInstituteId();
    if (!iid) return;
    const t = await token();
    setBatches((await listBatchesViaAPI(t, iid)) as Batch[]);
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    const weekAhead = new Date(Date.now() + 14 * 864e5).toISOString();
    setSessions((await listSessionsViaAPI(t, iid, weekAgo, weekAhead)) as Session[]);
  }

  useEffect(() => {
    if (!checking) load().catch((e) => setMsg(e instanceof Error ? e.message : "Load failed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking]);

  async function add() {
    const iid = getSelectedInstituteId();
    if (!iid || !form.batch_id || !form.title.trim()) return setMsg("Batch + title required.");
    try {
      await createSessionViaAPI(await token(), {
        institute_id: iid,
        batch_id: form.batch_id,
        title: form.title.trim(),
        starts_at: new Date(`${form.date}T${form.start}`).toISOString(),
        ends_at: new Date(`${form.date}T${form.end}`).toISOString(),
      });
      setMsg("Class scheduled! Overlap ho to 409 aayega.");
      load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Create failed"); }
  }

  if (checking) return <div className="glass p-6 text-sm">Checking login...</div>;

  return (
    <div className="space-y-4">
      <div className="glass-strong p-6">
        <h1 className="text-xl font-extrabold">Timetable ({sessions.length})</h1>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <select className="glass-input" value={form.batch_id} onChange={(e) => setForm({ ...form, batch_id: e.target.value })}>
            <option value="">Batch chuno...</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input className="glass-input" placeholder="Class title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input className="glass-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <input className="glass-input" type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
          <input className="glass-input" type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          <button onClick={add} className="btn-primary">Schedule</button>
        </div>
        {msg && <p className="mt-2 text-xs">{msg}</p>}
      </div>
      <div className="glass space-y-2 p-4">
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center justify-between border-b border-white/20 py-2 last:border-0">
            <div>
              <p className="font-bold">{s.title}</p>
              <p className="text-xs text-slate-500">{new Date(s.starts_at).toLocaleString("en-IN")} → {new Date(s.ends_at).toLocaleTimeString("en-IN")} • {s.status}</p>
            </div>
          </div>
        ))}
        {sessions.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Koi class nahi — upar se schedule karo.</p>}
      </div>
    </div>
  );
}
