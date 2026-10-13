"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { getSelectedInstituteId } from "@/lib/useInstitute";
import { convertEnquiryViaAPI, createEnquiryViaAPI, listEnquiriesViaAPI } from "@/lib/api";

type E = { id: string; name: string; phone: string | null; course: string | null; status: string };

export default function EnquiriesPage() {
  const { checking } = useRequireAuth();
  const [rows, setRows] = useState<E[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
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
    setRows((await listEnquiriesViaAPI(await token(), iid)) as E[]);
  }

  useEffect(() => {
    if (!checking) load().catch((e) => setMsg(e instanceof Error ? e.message : "Load failed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking]);

  async function add() {
    const iid = getSelectedInstituteId();
    if (!iid || !name.trim()) return setMsg("Name likho.");
    try {
      await createEnquiryViaAPI(await token(), { institute_id: iid, name: name.trim(), phone: phone.trim() || null });
      setName(""); setPhone(""); setMsg("Enquiry added!");
      load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Create failed"); }
  }

  async function convert(id: string) {
    const iid = getSelectedInstituteId();
    if (!iid) return;
    if (!confirm("Admit karke student banao? Duplicate phone wapas existing student dega.")) return;
    try {
      const res = (await convertEnquiryViaAPI(await token(), id, iid)) as { deduped?: boolean };
      setMsg(res.deduped ? "Already existed — linked, no duplicate." : "Admitted! Student ban gaya.");
      load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Convert failed"); }
  }

  if (checking) return <div className="glass p-6 text-sm">Checking login...</div>;

  return (
    <div className="space-y-4">
      <div className="glass-strong p-6">
        <h1 className="text-xl font-extrabold">Enquiries ({rows.length})</h1>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <input className="glass-input" placeholder="Name *" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="glass-input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button onClick={add} className="btn-primary">Add</button>
        </div>
        {msg && <p className="mt-2 text-xs">{msg}</p>}
      </div>
      <div className="glass space-y-2 p-4">
        {rows.map((e) => (
          <div key={e.id} className="flex items-center justify-between border-b border-white/20 py-2 last:border-0">
            <div>
              <p className="font-bold">{e.name}</p>
              <p className="text-xs text-slate-500">{e.phone || "—"} • {e.course || "—"} • {e.status}</p>
            </div>
            {e.status !== "admitted" && (
              <button onClick={() => convert(e.id)} className="btn-ghost !px-3 !py-1.5 text-xs">Admit →</button>
            )}
          </div>
        ))}
        {rows.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Koi enquiry nahi.</p>}
      </div>
    </div>
  );
}
