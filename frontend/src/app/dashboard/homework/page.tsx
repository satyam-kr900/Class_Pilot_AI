"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { getSelectedInstituteId } from "@/lib/useInstitute";
import { createAssignmentViaAPI, listAssignmentsViaAPI, listBatchesViaAPI } from "@/lib/api";

type A = { id: string; title: string; batch_id: string | null; due_date: string | null };

export default function HomeworkPage() {
  const { checking } = useRequireAuth();
  const [rows, setRows] = useState<A[]>([]);
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);
  const [title, setTitle] = useState("");
  const [batchId, setBatchId] = useState("");
  const [due, setDue] = useState("");
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
    setRows((await listAssignmentsViaAPI(t, iid)) as A[]);
    setBatches((await listBatchesViaAPI(t, iid)) as { id: string; name: string }[]);
  }

  useEffect(() => {
    if (!checking) load().catch((e) => setMsg(e instanceof Error ? e.message : "Load failed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking]);

  async function add() {
    const iid = getSelectedInstituteId();
    if (!iid || !title.trim()) return setMsg("Title likho.");
    try {
      await createAssignmentViaAPI(await token(), {
        institute_id: iid,
        batch_id: batchId || null,
        title: title.trim(),
        due_date: due || null,
      });
      setTitle(""); setBatchId(""); setDue(""); setMsg("Homework created!");
      load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Create failed"); }
  }

  if (checking) return <div className="glass p-6 text-sm">Checking login...</div>;

  return (
    <div className="space-y-4">
      <div className="glass-strong p-6">
        <h1 className="text-xl font-extrabold">Homework ({rows.length})</h1>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input className="glass-input" placeholder="Title *" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className="glass-input" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">All batches</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input className="glass-input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          <button onClick={add} className="btn-primary">Add</button>
        </div>
        {msg && <p className="mt-2 text-xs">{msg}</p>}
      </div>
      <div className="glass space-y-2 p-4">
        {rows.map((a) => (
          <div key={a.id} className="border-b border-white/20 py-2 last:border-0">
            <p className="font-bold">{a.title}</p>
            <p className="text-xs text-slate-500">Due: {a.due_date || "—"}</p>
          </div>
        ))}
        {rows.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Koi homework nahi.</p>}
      </div>
    </div>
  );
}
