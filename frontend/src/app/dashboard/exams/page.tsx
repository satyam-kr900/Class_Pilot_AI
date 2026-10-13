"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { getSelectedInstituteId } from "@/lib/useInstitute";
import { createExamViaAPI, enterMarksViaAPI, listBatchesViaAPI, listExamsViaAPI, publishExamViaAPI } from "@/lib/api";

type Exam = { id: string; name: string; batch_id: string | null; exam_date: string | null; status: string };

export default function ExamsPage() {
  const { checking } = useRequireAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState("");
  const [batchId, setBatchId] = useState("");
  const [scoreMap, setScoreMap] = useState<Record<string, string>>({});
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
    setExams((await listExamsViaAPI(t, iid)) as Exam[]);
    setBatches((await listBatchesViaAPI(t, iid)) as { id: string; name: string }[]);
    const { data: s } = await supabase.from("students").select("id,name").eq("institute_id", iid).eq("status", "active").order("name").limit(200);
    setStudents((s as { id: string; name: string }[]) ?? []);
  }

  useEffect(() => {
    if (!checking) load().catch((e) => setMsg(e instanceof Error ? e.message : "Load failed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking]);

  async function add() {
    const iid = getSelectedInstituteId();
    if (!iid || !name.trim()) return setMsg("Exam name likho.");
    try {
      await createExamViaAPI(await token(), { institute_id: iid, batch_id: batchId || null, name: name.trim() });
      setName(""); setBatchId(""); setMsg("Exam drafted! Marks ke baad Publish karo.");
      load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Create failed"); }
  }

  async function saveMarks(examId: string) {
    const iid = getSelectedInstituteId();
    if (!iid) return;
    const marks = Object.entries(scoreMap)
      .filter(([k, v]) => k.startsWith(`${examId}:`) && v.trim() !== "")
      .map(([k, v]) => ({ student_id: k.split(":")[1], score: Number(v), max_score: 100 }));
    if (!marks.length) return setMsg("Pehle scores likho.");
    try {
      await enterMarksViaAPI(await token(), examId, iid, marks);
      setMsg(`Saved ${marks.length} marks (audit logged).`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Save failed"); }
  }

  async function publish(examId: string, status: string) {
    const iid = getSelectedInstituteId();
    if (!iid) return;
    try {
      await publishExamViaAPI(await token(), examId, iid, status);
      setMsg(status === "published" ? "Published! Students/parents can now see." : "Moved to draft.");
      load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Publish failed"); }
  }

  if (checking) return <div className="glass p-6 text-sm">Checking login...</div>;

  return (
    <div className="space-y-4">
      <div className="glass-strong p-6">
        <h1 className="text-xl font-extrabold">Exams ({exams.length})</h1>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <input className="glass-input" placeholder="Exam name * (e.g. Maths UT-1)" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="glass-input" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">No batch</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button onClick={add} className="btn-primary">Create Draft</button>
        </div>
        {msg && <p className="mt-2 text-xs">{msg}</p>}
      </div>
      {exams.map((ex) => (
        <div key={ex.id} className="glass space-y-2 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold">{ex.name}</p>
              <p className="text-xs text-slate-500">{ex.status} • {ex.exam_date || "no date"}</p>
            </div>
            <button onClick={() => publish(ex.id, ex.status === "published" ? "draft" : "published")} className="btn-ghost !px-3 !py-1.5 text-xs">
              {ex.status === "published" ? "Unpublish" : "Publish"}
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {students.slice(0, 10).map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <span className="w-32 truncate text-xs font-bold">{s.name}</span>
                <input className="glass-input !py-1.5" placeholder="Score /100" type="number" min="0" max="100"
                  value={scoreMap[`${ex.id}:${s.id}`] ?? ""} 
                  onChange={(e) => setScoreMap({ ...scoreMap, [`${ex.id}:${s.id}`]: e.target.value })} />
              </div>
            ))}
          </div>
          <button onClick={() => saveMarks(ex.id)} className="btn-primary w-full !py-2 text-xs">Save Marks ({ex.name})</button>
        </div>
      ))}
      {exams.length === 0 && <div className="glass p-6 text-center text-sm text-slate-500">Koi exam nahi — draft banao, marks dalo, publish karo.</div>}
    </div>
  );
}
