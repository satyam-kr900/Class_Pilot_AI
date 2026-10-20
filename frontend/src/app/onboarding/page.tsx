"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { createInstituteViaAPI, getInstituteViaAPI, myInstitutes } from "@/lib/api";

type Verified = {
  verified: boolean;
  institute: { id: string; name: string; plan: string; created_at: string };
  my_role: string;
  stats: { students: number; batches: number };
};

const ROLE_JOIN_HINT: Record<string, string> = {
  teacher: "👩‍🏫 Teacher role chuna tha? Asli access ke liye apne institute se invite mango (owner: Batches → teacher assign). Tab tak explore karne ke liye neeche apna demo institute banao.",
  parent: "👨‍👩‍👧 Parent role chuna tha? Bacche se link hone ke liye institute se guardian linking mango. Tab tak explore karne ke liye neeche apna demo institute banao.",
  student: "🎓 Student role chuna tha? Apne record se link hone ke liye institute se account linking mango. Tab tak explore karne ke liye neeche apna demo institute banao.",
};

type OnboardingFormProps = {
  wantRole: string;
};

function OnboardingForm({ wantRole }: OnboardingFormProps) {
  const router = useRouter();
  const joinHint = ROLE_JOIN_HINT[wantRole] ?? "";
  const [checking, setChecking] = useState(true);
  const [verified, setVerified] = useState<Verified | null>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  async function token(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token;
    if (!t) throw new Error("Session nahi mila — pehle login karo.");
    return t;
  }

  // Already koi institute hai? → verify karke uska data dikhao (form mat dikhao)
  useEffect(() => {
    (async () => {
      try {
        const t = await token();
        const res = await myInstitutes(t);
        const first = res.memberships[0];
        if (first) {
          const v = await getInstituteViaAPI(t, first.institute_id);
          setVerified(v);
          localStorage.setItem("cp_institute_id", first.institute_id);
        }
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Load failed");
      } finally {
        setChecking(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    if (name.trim().length < 2) return setMsg("Institute ka naam likho (kam se kam 2 letters).");
    setSaving(true);
    setMsg("Institute ban raha hai...");
    try {
      const t = await token();
      const inst = (await createInstituteViaAPI(t, {
        name: name.trim(),
        city: city.trim() || null,
        phone: phone.trim() || null,
      })) as { id: string };
      const v = await getInstituteViaAPI(t, inst.id);
      setVerified(v);
      localStorage.setItem("cp_institute_id", inst.id);
      setMsg("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  if (checking) return <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4"><div className="glass p-6 text-sm">Checking...</div></main>;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4">
      <div className="glass-strong w-full space-y-4 p-8">
        {!verified ? (
          <>
            <h1 className="text-2xl font-extrabold">Apna Institute banao 🏛️</h1>
            <p className="text-sm text-slate-500">Naam likho → Verify → Dashboard. Yehi tumhara coaching centre hoga.</p>
            {joinHint && (
              <div className="rounded-2xl border border-amber-300/60 bg-amber-50/70 px-4 py-2.5 text-xs font-medium text-slate-700">
                {joinHint}
              </div>
            )}
            <input className="glass-input" placeholder="Institute name * (e.g. Sunrise Coaching)" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="grid gap-3 md:grid-cols-2">
              <input className="glass-input" placeholder="City (optional)" value={city} onChange={(e) => setCity(e.target.value)} />
              <input className="glass-input" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <button onClick={create} disabled={saving} className="btn-primary w-full disabled:opacity-50">
              {saving ? "Ban raha hai..." : "Create & Verify →"}
            </button>
            {msg && <p className="text-xs">{msg}</p>}
          </>
        ) : (
          <>
            <p className="inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-extrabold text-red-700">✓ Verified</p>
            <h1 className="text-2xl font-extrabold">{verified.institute.name}</h1>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="glass p-4"><p className="text-xs text-slate-500">Your role</p><p className="text-lg font-extrabold">{verified.my_role}</p></div>
              <div className="glass p-4"><p className="text-xs text-slate-500">Plan</p><p className="text-lg font-extrabold">{verified.institute.plan}</p></div>
              <div className="glass p-4"><p className="text-xs text-slate-500">Students</p><p className="text-lg font-extrabold">{verified.stats.students}</p></div>
            </div>
            <div className="glass p-4">
              <p className="text-xs text-slate-500">Batches</p>
              <p className="text-lg font-extrabold">{verified.stats.batches}</p>
              <p className="mt-2 break-all text-[11px] text-slate-400">ID: {verified.institute.id}</p>
            </div>
            <button
              onClick={() => {
                if (wantRole && wantRole !== "owner") router.push(`/profile`);
                else router.push("/dashboard");
              }}
              className="btn-primary w-full"
            >
              Open Dashboard →
            </button>
            <button onClick={() => setVerified(null)} className="btn-ghost w-full">+ Ek aur institute banao</button>
          </>
        )}
        <Link href="/dashboard" className="block text-center text-xs font-semibold text-slate-500 underline">Skip → Dashboard</Link>
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const search = useSearchParams();
  const wantRole = search.get("role") || "";
  const joinHint = ROLE_JOIN_HINT[wantRole] ?? "";

  return (
    <Suspense fallback={<main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4"><p className="text-sm">Loading...</p></main>}>
      <OnboardingForm wantRole={wantRole} />
    </Suspense>
  );
}