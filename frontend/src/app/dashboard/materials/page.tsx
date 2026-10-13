"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { getSelectedInstituteId } from "@/lib/useInstitute";
import { listMaterialsViaAPI, requestMaterialUploadViaAPI, confirmMaterialViaAPI } from "@/lib/api";

type M = { id: string; title: string; batch_id: string | null; file_path: string; created_at: string };

export default function MaterialsPage() {
  const { checking } = useRequireAuth();
  const [rows, setRows] = useState<M[]>([]);
  const [msg, setMsg] = useState("Loading...");
  const [pct, setPct] = useState<number | null>(null);

  async function load() {
    const iid = getSelectedInstituteId();
    if (!iid) throw new Error("Institute select karo.");
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    if (!t) throw new Error("Session expired.");
    setRows((await listMaterialsViaAPI(t, iid)) as M[]);
    setMsg("");
  }

  useEffect(() => {
    if (checking) return;
    load().catch((e) => setMsg(e instanceof Error ? e.message : "Load failed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking]);

  async function onFile(file: File) {
    const iid = getSelectedInstituteId();
    if (!iid) return setMsg("Institute select karo.");
    if (file.size > 25 * 1024 * 1024) return setMsg("Max 25MB.");
    setPct(0);
    setMsg("Uploading...");
    try {
      const { data: s } = await supabase.auth.getSession();
      const t = s.session?.access_token;
      if (!t) throw new Error("Session expired.");
      const up = (await requestMaterialUploadViaAPI(t, { institute_id: iid, filename: file.name, mime: file.type || null })) as { file_path: string; upload_url: string };
      await putWithProgress(up.upload_url, file, setPct, file.type);
      await confirmMaterialViaAPI(t, { institute_id: iid, title: file.name.replace(/\.[^.]+$/, ""), file_path: up.file_path, mime: file.type || null, size_bytes: file.size });
      setMsg("Uploaded!");
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed — staff only, bucket 006 run kiya?");
    } finally {
      setPct(null);
    }
  }

  if (checking) return <div className="glass p-6 text-sm">Checking login...</div>;

  return (
    <div className="space-y-4">
      <div className="glass-strong p-6">
        <h1 className="text-xl font-extrabold">Study Materials ({rows.length})</h1>
        <p className="text-sm text-slate-500">
          PDFs/notes staff upload karte hain (backend signed URLs, private bucket).
        </p>
        <label className="btn-primary mt-3 inline-block cursor-pointer">
          Upload PDF/Note
          <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
        </label>
        {pct !== null && <p className="mt-2 text-xs font-bold">{pct}% uploaded...</p>}
      </div>
      {msg && <p className="text-xs">{msg}</p>}
      <div className="glass space-y-2 p-4">
        {rows.map((m) => (
          <div key={m.id} className="border-b border-white/20 py-2 last:border-0">
            <p className="font-bold">{m.title}</p>
            <p className="text-xs text-slate-500">{new Date(m.created_at).toLocaleDateString("en-IN")}</p>
          </div>
        ))}
        {rows.length === 0 && !msg && <p className="py-6 text-center text-sm text-slate-500">Koi material nahi.</p>}
      </div>
    </div>
  );
}

function putWithProgress(url: string, file: File, onPct: (n: number) => void, mime: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (mime) xhr.setRequestHeader("Content-Type", mime);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onPct(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}
