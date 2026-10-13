"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { getSelectedInstituteId, useInstitute } from "@/lib/useInstitute";
import {
  adminCreateLearnerAccountViaAPI,
  adminCreateStudentFullViaAPI,
  adminCreateTeacherViaAPI,
  adminMembersViaAPI,
} from "@/lib/api";

type Creds = { email: string; temp_password: string; role: string } | null;

export default function AdminPage() {
  const { checking } = useRequireAuth();
  const { role } = useInstitute();
  const [tab, setTab] = useState<"teacher" | "student" | "members">("teacher");
  const [msg, setMsg] = useState("");
  const [creds, setCreds] = useState<Creds>(null);
  const [members, setMembers] = useState<{ user_id: string; role: string }[]>([]);

  // Teacher form
  const [tName, setTName] = useState("");
  const [tEmail, setTEmail] = useState("");
  // Student form
  const [sName, setSName] = useState("");
  const [sFee, setSFee] = useState("");
  const [sPPhone, setSPPhone] = useState("");
  const [sSPhone, setSSPhone] = useState("");
  // Login form
  const [lKind, setLKind] = useState("parent");
  const [lEmail, setLEmail] = useState("");
  const [lStudentId, setLStudentId] = useState("");
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);

  async function token() {
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token;
    if (!t) throw new Error("Session expired.");
    return t;
  }
  function iid() {
    const id = getSelectedInstituteId();
    if (!id) throw new Error("Institute select karo.");
    return id;
  }

  async function loadMembers() {
    try {
      setMembers((await adminMembersViaAPI(await token(), iid())) as { user_id: string; role: string }[]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Load failed");
    }
  }

  async function loadStudents() {
    const id = getSelectedInstituteId();
    if (!id) return;
    const { data } = await supabase.from("students").select("id,name").eq("institute_id", id).eq("status", "active").order("name").limit(200);
    setStudents((data as { id: string; name: string }[]) ?? []);
  }

  useEffect(() => {
    if (!checking) {
      loadMembers();
      loadStudents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking]);

  async function addTeacher() {
    if (tName.trim().length < 2 || !tEmail.includes("@")) return setMsg("Teacher ka naam + valid email likho.");
    setMsg("Teacher ban raha hai...");
    setCreds(null);
    try {
      const r = (await adminCreateTeacherViaAPI(await token(), { institute_id: iid(), name: tName.trim(), email: tEmail.trim() })) as { email: string; temp_password: string; role: string };
      setCreds(r);
      setTName(""); setTEmail("");
      setMsg("Teacher ready! Neeche password copy karke teacher ko bhejo.");
      loadMembers();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  async function addStudent() {
    if (sName.trim().length < 1) return setMsg("Student ka naam likho.");
    setMsg("Student ban raha hai...");
    try {
      await adminCreateStudentFullViaAPI(await token(), {
        institute_id: iid(),
        name: sName.trim(),
        monthly_fee: Number(sFee) || 0,
        guardian_phone: sPPhone.trim() || null,
        student_phone: sSPhone.trim() || null,
      });
      setSName(""); setSFee(""); setSPPhone(""); setSSPhone("");
      setMsg("Student + guardian ready! Ab neeche se login banao.");
      loadStudents();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  async function addLogin() {
    if (!lEmail.includes("@") || !lStudentId) return setMsg("Email + student chuno.");
    setMsg("Login ban raha hai...");
    setCreds(null);
    try {
      const r = (await adminCreateLearnerAccountViaAPI(await token(), {
        institute_id: iid(),
        kind: lKind,
        email: lEmail.trim(),
        student_id: lStudentId,
      })) as { email: string; temp_password: string; role: string };
      setCreds(r);
      setLEmail(""); setLStudentId("");
      setMsg(`${lKind === "parent" ? "Parent" : "Student"} login ready! Password share karo.`);
      loadMembers();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed — parent ke liye guardian link chahiye (student-full se banao).");
    }
  }

  if (checking) return <div className="glass p-6 text-sm">Checking login...</div>;
  if (role === "student" || role === "parent")
    return <div className="glass p-6 text-sm font-bold">⛔ Admin panel sirf owner/staff ke liye hai.</div>;

  return (
    <div className="space-y-4">
      <div className="glass-strong p-6">
        <h1 className="text-xl font-extrabold">🛠️ Admin — Sabko Add Karo</h1>
        <p className="text-xs text-slate-500">Teacher/student/parent ka login yahin banta hai. Password ek baar dikhega — turant share karo.</p>
        <div className="mt-3 flex gap-2">
          {(["teacher", "student", "members"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setMsg(""); setCreds(null); if (t === "members") loadMembers(); }}
              className={`rounded-full px-4 py-1.5 text-xs font-bold ${tab === t ? "bg-[#0a1633] text-white" : "bg-white/40"}`}>
              {t === "teacher" ? "👩‍🏫 Teacher" : t === "student" ? "🎓 Student/Parent" : `👥 Members (${members.length})`}
            </button>
          ))}
        </div>
      </div>

      {creds && (
        <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-4 text-sm">
          <p className="font-extrabold">✅ Login ready ({creds.role}) — abhi copy karo, dobara nahi dikhega:</p>
          <p className="mt-2 font-mono">Email: <b>{creds.email}</b></p>
          <p className="font-mono">Password: <b>{creds.temp_password}</b></p>
        </div>
      )}
      {msg && <p className="text-xs">{msg}</p>}

      {tab === "teacher" && (
        <div className="glass space-y-2 p-4">
          <p className="text-sm font-bold">Teacher detail bharo → login milega → apne assigned kaam pe jayega</p>
          <input className="glass-input" placeholder="Teacher name *" value={tName} onChange={(e) => setTName(e.target.value)} />
          <input className="glass-input" placeholder="Teacher email * (login isi se)" value={tEmail} onChange={(e) => setTEmail(e.target.value)} />
          <button onClick={addTeacher} className="btn-primary w-full">Create Teacher Login →</button>
          <p className="text-[11px] text-slate-500">Batch assign baad me: Batches page se (teacher id members list me milega).</p>
        </div>
      )}

      {tab === "student" && (
        <div className="space-y-4">
          <div className="glass space-y-2 p-4">
            <p className="text-sm font-bold">Step 1 — Student + parent mobile add karo</p>
            <input className="glass-input" placeholder="Student name *" value={sName} onChange={(e) => setSName(e.target.value)} />
            <div className="grid gap-2 md:grid-cols-3">
              <input className="glass-input" placeholder="Monthly fee" type="number" min="0" value={sFee} onChange={(e) => setSFee(e.target.value)} />
              <input className="glass-input" placeholder="Parent mobile" inputMode="numeric" value={sPPhone} onChange={(e) => setSPPhone(e.target.value)} />
              <input className="glass-input" placeholder="Student mobile (self)" inputMode="numeric" value={sSPhone} onChange={(e) => setSSPhone(e.target.value)} />
            </div>
            <button onClick={addStudent} className="btn-primary w-full">Add Student →</button>
          </div>
          <div className="glass space-y-2 p-4">
            <p className="text-sm font-bold">Step 2 — Parent/Student login banao</p>
            <div className="flex gap-2">
              {(["parent", "student"] as const).map((k) => (
                <button key={k} onClick={() => setLKind(k)} className={`flex-1 rounded-2xl px-4 py-2 text-xs font-bold ${lKind === k ? "bg-red-500 text-white" : "bg-white/40"}`}>
                  {k === "parent" ? "👨‍👩‍👧 Parent" : "🎓 Student"}
                </button>
              ))}
            </div>
            <select className="glass-input" value={lStudentId} onChange={(e) => setLStudentId(e.target.value)}>
              <option value="">Student chuno...</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input className="glass-input" placeholder={`${lKind} email * (login isi se)`} value={lEmail} onChange={(e) => setLEmail(e.target.value)} />
            <button onClick={addLogin} className="btn-primary w-full">Create {lKind} Login →</button>
          </div>
        </div>
      )}

      {tab === "members" && (
        <div className="glass space-y-2 p-4">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between border-b border-white/20 py-2 last:border-0">
              <p className="font-mono text-xs">{m.user_id.slice(0, 8)}...</p>
              <span className="rounded-full bg-white/40 px-3 py-1 text-xs font-bold">{m.role}</span>
            </div>
          ))}
          {members.length === 0 && <p className="py-4 text-center text-sm text-slate-500">Koi member nahi.</p>}
        </div>
      )}
    </div>
  );
}
