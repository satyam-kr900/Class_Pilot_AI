"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { getSelectedInstituteId } from "@/lib/useInstitute";
import { createBatchViaAPI, enrolViaAPI, listBatchesViaAPI } from "@/lib/api";

type Batch = { id: string; name: string; subject: string | null; capacity: number | null };
type Student = { id: string; name: string };

export default function BatchesPage() {
  const { checking } = useRequireAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [msg, setMsg] = useState("");

  async function token() {
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token;
    if (!t) throw new Error("Session expired — dobara login karo.");
    return t;
  }

  async function load() {
    const iid = getSelectedInstituteId();
    if (!iid) return;
    const t = await token();
    const rows = (await listBatchesViaAPI(t, iid)) as Batch[];
    setBatches(rows);
    const { data: s } = await supabase.from("students").select("id,name").eq("institute_id", iid).eq("status", "active").order("name").limit(200);
    setStudents((s as Student[]) ?? []);
  }

  useEffect(() => {
    if (!checking) load().catch((e) => setMsg(e instanceof Error ? e.message : "Load failed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking]);

  async function add() {
    const iid = getSelectedInstituteId();
    if (!iid) return setMsg("Institute select karo.");
    if (!name.trim()) return setMsg("Batch name likho.");
    try {
      await createBatchViaAPI(await token(), { institute_id: iid, name: name.trim(), subject: subject.trim() || null });
      setName(""); setSubject(""); setMsg("Batch created!");
      load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Create failed"); }
  }

  async function enrol(batchId: string, studentId: string) {
    if (!studentId) return;
    const iid = getSelectedInstituteId();
    if (!iid) return;
    try {
      await enrolViaAPI(await token(), batchId, iid, studentId);
      setMsg("Enrolled!");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Enrol failed"); }
  }

  if (checking) return <div className="glass p-6 text-sm">Checking login...</div>;

  return (
    <div className="space-y-4">
      <div className="glass-strong p-6">
        <h1 className="text-xl font-extrabold">Batches ({batches.length})</h1>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <input className="glass-input" placeholder="Batch name * (e.g. 10th-A)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="glass-input" placeholder="Subject (optional)" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <button onClick={add} className="btn-primary">Add Batch</button>
        </div>
        {msg && <p className="mt-2 text-xs">{msg}</p>}
      </div>
      <div className="glass space-y-2 p-4">
        {batches.map((b) => (
          <EnrolRow key={b.id} batch={b} students={students} onEnrol={enrol} />
        ))}
        {batches.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Koi batch nahi — upar se banao. Teachers ko sirf assigned batches dikhenge.</p>}
      </div>
    </div>
  );
}

function EnrolRow({ batch, students, onEnrol }: { batch: Batch; students: Student[]; onEnrol: (b: string, s: string) => void }) {
  const [sid, setSid] = useState("");
  return (
    <div className="flex flex-col gap-2 border-b border-white/20 py-3 last:border-0 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="font-bold">{batch.name}</p>
        <p className="text-xs text-slate-500">{batch.subject || "No subject"}{batch.capacity ? ` • cap ${batch.capacity}` : ""}</p>
      </div>
      <div className="flex gap-2">
        <select className="rounded-xl border bg-white px-2 py-1.5 text-sm" value={sid} onChange={(e) => setSid(e.target.value)}>
          <option value="">Student chuno...</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button onClick={() => onEnrol(batch.id, sid)} className="btn-ghost !px-3 !py-1.5 text-xs">Enrol</button>
      </div>
    </div>
  );
}
