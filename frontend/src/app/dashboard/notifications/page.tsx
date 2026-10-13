"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { getSelectedInstituteId } from "@/lib/useInstitute";
import { createNotificationViaAPI, listNotificationsViaAPI } from "@/lib/api";

type N = { id: string; title: string; body: string; audience: string; created_at: string };

export default function NotificationsPage() {
  const { checking } = useRequireAuth();
  const [rows, setRows] = useState<N[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
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
    setRows((await listNotificationsViaAPI(await token(), iid)) as N[]);
  }

  useEffect(() => {
    if (!checking) load().catch((e) => setMsg(e instanceof Error ? e.message : "Load failed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking]);

  async function send() {
    const iid = getSelectedInstituteId();
    if (!iid || !title.trim() || !body.trim()) return setMsg("Title + body likho.");
    try {
      await createNotificationViaAPI(await token(), { institute_id: iid, title: title.trim(), body: body.trim(), audience: "all" });
      setTitle(""); setBody(""); setMsg("Announcement sent (in-app)!");
      load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Send failed — staff only"); }
  }

  if (checking) return <div className="glass p-6 text-sm">Checking login...</div>;

  return (
    <div className="space-y-4">
      <div className="glass-strong p-6">
        <h1 className="text-xl font-extrabold">Notifications ({rows.length})</h1>
        <p className="text-xs text-slate-500">In-app working. WhatsApp = approved template + guardian opt-in, backend POST /api/v1/notifications/whatsapp.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <input className="glass-input" placeholder="Title *" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="glass-input" placeholder="Message *" value={body} onChange={(e) => setBody(e.target.value)} />
          <button onClick={send} className="btn-primary">Announce</button>
        </div>
        {msg && <p className="mt-2 text-xs">{msg}</p>}
      </div>
      <div className="glass space-y-2 p-4">
        {rows.map((n) => (
          <div key={n.id} className="border-b border-white/20 py-2 last:border-0">
            <p className="font-bold">{n.title}</p>
            <p className="text-sm">{n.body}</p>
            <p className="text-xs text-slate-500">{n.audience} • {new Date(n.created_at).toLocaleString("en-IN")}</p>
          </div>
        ))}
        {rows.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Koi notification nahi.</p>}
      </div>
    </div>
  );
}
