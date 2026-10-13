"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { getSelectedInstituteId } from "@/lib/useInstitute";
import { subscriptionStatusViaAPI, createBillingOrderViaAPI } from "@/lib/api";

type Status = { plan: string; limits: Record<string, number | boolean>; usage: Record<string, number>; over_limits: Record<string, boolean>; note?: string };

export default function SubscriptionPage() {
  const { checking } = useRequireAuth();
  const [st, setSt] = useState<Status | null>(null);
  const [msg, setMsg] = useState("Loading...");
  const [msg2, setMsg2] = useState("");

  useEffect(() => {
    if (checking) return;
    (async () => {
      try {
        const iid = getSelectedInstituteId();
        if (!iid) throw new Error("Institute select karo.");
        const { data: s } = await supabase.auth.getSession();
        const t = s.session?.access_token;
        if (!t) throw new Error("Session expired.");
        setSt((await subscriptionStatusViaAPI(t, iid)) as Status);
        setMsg("");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Load failed");
      }
    })();
  }, [checking]);

  if (checking) return <div className="glass p-6 text-sm">Checking login...</div>;

  return (
    <div className="space-y-4">
      <div className="glass-strong p-6">
        <h1 className="text-xl font-extrabold">Subscription</h1>
        <p className="text-sm text-slate-500">Plan limits server-side enforced. Prices: Free ₹0, Tutor ₹499, Growth ₹999, Pro ₹1499.</p>
      </div>
      {msg && <p className="text-xs">{msg}</p>}
      {st && (
        <div className="grid gap-3 md:grid-cols-3">
          {(["students", "staff", "batches"] as const).map((k) => (
            <div key={k} className="glass p-5">
              <p className="text-xs text-slate-500">{k}</p>
              <p className="text-2xl font-extrabold">{st.usage[k]} / {String(st.limits[k])}</p>
              {st.over_limits[k] && <p className="text-xs font-bold text-red-500">Over limit — upgrade karo</p>}
            </div>
          ))}
        </div>
      )}
      {st && <p className="text-xs text-slate-500">Current plan: {st.plan}. {st.note}</p>}
      {st && (
        <div className="glass space-y-2 p-4">
          <p className="text-sm font-bold">Upgrade (Razorpay — verified by webhook, never client redirect alone)</p>
          <div className="flex flex-wrap gap-2">
            {(["tutor", "growth", "pro"] as const).map((p) => (
              <button key={p} onClick={() => upgrade(p)} className="btn-ghost !px-3 !py-1.5 text-xs">
                {p} →
              </button>
            ))}
          </div>
          {msg2 && <p className="text-xs">{msg2}</p>}
        </div>
      )}
    </div>
  );

  async function upgrade(plan: string) {
    const iid = getSelectedInstituteId();
    if (!iid) return;
    try {
      const { data: s } = await supabase.auth.getSession();
      const t = s.session?.access_token;
      if (!t) throw new Error("Session expired.");
      const res = (await createBillingOrderViaAPI(t, { institute_id: iid, plan })) as { mode?: string; note?: string; order?: { id?: string } };
      setMsg2(res.mode === "manual" ? `Manual mode: ${res.note}` : `Order ${res.order?.id} — Razorpay checkout kholo, webhook activate karega.`);
    } catch (e) {
      setMsg2(e instanceof Error ? e.message : "Order failed");
    }
  }
}
