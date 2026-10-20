"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { findAccountViaAPI } from "@/lib/api";

type Result = {
  found: boolean;
  linked: boolean;
  institute: { id: string; name: string };
  student: string;
  role?: string;
  login_email_masked?: string;
  note?: string;
};

export default function FindAccountPage() {
  return (
    <Suspense fallback={<main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4"><p className="text-sm">Loading...</p></main>}>
      <FinderForm />
    </Suspense>
  );
}

function FinderForm() {
  const params = useSearchParams();
  const [who, setWho] = useState(params.get("who") === "student" ? "student" : "parent");
  const [institute, setInstitute] = useState("");
  const [student, setStudent] = useState("");
  const [mobile, setMobile] = useState("");
  const [msg, setMsg] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  async function find() {
    if (!institute.trim() || !student.trim() || !mobile.trim()) {
      setMsg("Teeno likho: institute + student + mobile.");
      return;
    }
    setBusy(true);
    setMsg("");
    setRes(null);
    try {
      const r = await findAccountViaAPI({
        institute_name: institute.trim(),
        student_name: student.trim(),
        mobile: mobile.trim(),
        who,
      });
      setRes(r);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
      <div className="glass-strong w-full space-y-4 md:space-y-3 p-6 md:p-8">
        <h1 className="text-2xl md:text-3xl font-extrabold">📱 Account dhoondo</h1>
        <p className="text-sm md:text-base text-slate-500">
          Parent: <b>institute + bacche ka naam + PARENT mobile</b> (form wala).
          Student: <b>institute + apna naam + PERSONAL mobile</b>. Milte hi login email ka hint milega.
        </p>
        <div className="flex gap-2">
          {(["parent", "student"] as const).map((w) => (
            <button
              key={w}
              onClick={() => setWho(w)}
              className={`flex-1 rounded-2xl px-4 py-2.5 text-sm font-bold ${who === w ? "bg-red-500 text-white" : "bg-white/40"}`}
            >
              {w === "parent" ? "👨‍👩‍👧 Parent" : "🎓 Student"}
            </button>
          ))}
        </div>
        <input className="glass-input" placeholder="Institute name *" value={institute} onChange={(e) => setInstitute(e.target.value)} />
        <input className="glass-input" placeholder={who === "parent" ? "Bacche ka naam *" : "Apna naam *"} value={student} onChange={(e) => setStudent(e.target.value)} />
        <input className="glass-input" placeholder="10-digit mobile *" inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value)} />
        <button onClick={find} disabled={busy} className="btn-primary w-full disabled:opacity-50">
          {busy ? "Dhoondh rahe..." : "Find my login →"}
        </button>
        {msg && <p className="text-xs">{msg}</p>}
        {res && (
          <div className="rounded-2xl border border-red-300/60 bg-red-50/60 p-4 text-sm">
            <p className="font-extrabold">✓ {res.student} — {res.institute.name}</p>
            {res.linked ? (
              <>
                <p className="mt-2">Login email: <span className="font-mono font-bold">{res.login_email_masked}</span></p>
                <Link href="/login" className="btn-primary mt-3 block text-center">Is email se Login →</Link>
              </>
            ) : (
              <p className="mt-2">{res.note}</p>
            )}
          </div>
        )}
        <Link href="/login" className="block text-center text-xs font-semibold text-slate-500 underline">← Back to Login</Link>
      </div>
    </main>
  );
}
