"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { monthStart, useRequireAuth } from "@/lib/useRequireAuth";
import { getSelectedInstituteId } from "@/lib/useInstitute";
import { collectFeeViaAPI } from "@/lib/api";

type Row = { id: string; name: string; batch: string | null; monthly_fee: number; guardian_phone?: string | null };

export default function FeesPage() {
  const { checking } = useRequireAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState("cash");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    const instituteId = getSelectedInstituteId();
    let sq = supabase.from("students").select("id,name,batch,monthly_fee").order("name");
    if (instituteId) sq = sq.eq("institute_id", instituteId).eq("status", "active");
    const { data: s } = await sq;
    setRows((s as Row[]) ?? []);
    let pq = supabase.from("fee_payments").select("student_id").gte("payment_date", monthStart()).limit(500);
    if (instituteId) pq = pq.eq("institute_id", instituteId);
    const { data: p } = await pq;
    setPaidIds(new Set(((p ?? []) as { student_id: string }[]).map((x) => x.student_id)));
  }

  useEffect(() => {
    if (!checking) load();
  }, [checking]);

  const total = rows.reduce((s, r) => s + Number(r.monthly_fee || 0), 0);
  const collected = rows.filter((r) => paidIds.has(r.id)).reduce((s, r) => s + Number(r.monthly_fee || 0), 0);

  async function collect(s: Row) {
    const instituteId = getSelectedInstituteId();
    if (!instituteId) {
      setMsg("Institute select karo (upar switcher se).");
      return;
    }
    const amount = Number(s.monthly_fee || 0);
    if (!(amount > 0)) {
      setMsg("Is student ki monthly fee 0 hai.");
      return;
    }
    setBusy(s.id);
    setMsg("");
    // Idempotency: one UUID per click. Retry with SAME key never double-charges.
    const idempotency_key =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${s.id}`;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expired — dobara login karo.");
      const saved = (await collectFeeViaAPI(token, {
        institute_id: instituteId,
        student_id: s.id,
        amount,
        payment_method: method,
        idempotency_key,
      })) as { receipt_no?: string };
      setMsg(saved?.receipt_no ? `Collected! Receipt ${saved.receipt_no}` : "Collected!");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Collect failed");
    } finally {
      setBusy(null);
    }
  }

  if (checking) return <div className="glass p-6 text-sm">Checking login...</div>;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass p-5"><p className="text-xs text-slate-500">Expected</p><p className="text-2xl font-extrabold">₹{total}</p></div>
        <div className="glass p-5"><p className="text-xs text-slate-500">Collected</p><p className="text-2xl font-extrabold text-red-600">₹{collected}</p></div>
        <div className="glass p-5"><p className="text-xs text-slate-500">Pending</p><p className="text-2xl font-extrabold text-red-500">₹{Math.max(0, total - collected)}</p></div>
      </div>
      <div className="glass flex items-center gap-2 p-4">
        <span className="text-xs font-bold">Method:</span>
        {["cash", "upi", "bank", "other"].map((m) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${method === m ? "bg-red-500 text-white" : "bg-white/40"}`}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>
      {msg && <p className="text-xs">{msg}</p>}
      <div className="glass p-4">
        {rows.map((s) => {
          const paid = paidIds.has(s.id);
          return (
            <div key={s.id} className="flex items-center justify-between border-b border-white/20 py-3 last:border-0">
              <div>
                <p className="font-bold">{s.name}</p>
                <p className="text-xs text-slate-500">₹{s.monthly_fee} • {s.batch || "No batch"} • {paid ? "Paid" : "Due"}</p>
              </div>
              {paid ? (
                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">✓ Paid</span>
              ) : (
                <button onClick={() => collect(s)} disabled={busy === s.id} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50">
                  {busy === s.id ? "..." : "Collect"}
                </button>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Pehle students add karo.</p>}
      </div>
    </div>
  );
}
