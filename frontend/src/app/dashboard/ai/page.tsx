"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { getSelectedInstituteId } from "@/lib/useInstitute";
import { aiAdminViaAPI, aiExplainViaAPI, aiInsightsViaAPI, aiQuizViaAPI } from "@/lib/api";

export default function AIPage() {
  const { checking } = useRequireAuth();
  const [tab, setTab] = useState<"insights" | "explain" | "quiz" | "admin">("insights");
  const [out, setOut] = useState("");
  const [subject, setSubject] = useState("Maths");
  const [topic, setTopic] = useState("");
  const [question, setQuestion] = useState("Which fees are outstanding?");
  const [busy, setBusy] = useState(false);

  async function token() {
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token;
    if (!t) throw new Error("Session expired.");
    return t;
  }

  async function runInsights() {
    const iid = getSelectedInstituteId();
    if (!iid) return setOut("Institute select karo.");
    setBusy(true);
    try {
      const res = await aiInsightsViaAPI(await token(), iid);
      setOut(JSON.stringify(res, null, 2));
    } catch (e) { setOut(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!checking && tab === "insights" && !out) runInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking, tab]);

  async function runExplain() {
    const iid = getSelectedInstituteId();
    if (!iid || !topic.trim()) return setOut("Topic likho.");
    setBusy(true);
    try {
      const res = (await aiExplainViaAPI(await token(), { institute_id: iid, subject, topic: topic.trim(), level: "class" })) as { explanation?: string };
      setOut(res.explanation ?? JSON.stringify(res));
    } catch (e) { setOut(e instanceof Error ? e.message : "Failed — AI_API_KEY set hai?"); }
    finally { setBusy(false); }
  }

  async function runQuiz() {
    const iid = getSelectedInstituteId();
    if (!iid || !topic.trim()) return setOut("Topic likho.");
    setBusy(true);
    try {
      const res = await aiQuizViaAPI(await token(), { institute_id: iid, subject, topic: topic.trim(), level: "class", count: 5, qtype: "mcq" });
      setOut(JSON.stringify(res, null, 2) + "\n\n[DRAFT — publish se pehle teacher review zaroori]");
    } catch (e) { setOut(e instanceof Error ? e.message : "Failed — AI_API_KEY set hai?"); }
    finally { setBusy(false); }
  }

  async function runAdmin() {
    const iid = getSelectedInstituteId();
    if (!iid || !question.trim()) return setOut("Question likho.");
    setBusy(true);
    try {
      const res = await aiAdminViaAPI(await token(), { institute_id: iid, question: question.trim() });
      setOut(JSON.stringify(res, null, 2));
    } catch (e) { setOut(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  if (checking) return <div className="glass p-6 text-sm">Checking login...</div>;

  return (
    <div className="space-y-4">
      <div className="glass-strong p-6">
        <h1 className="text-xl font-extrabold">AI Workspace</h1>
        <p className="text-xs text-slate-500">Insights/admin bina key chalte hain (real data). Explain/quiz ko backend AI_API_KEY chahiye. Daily limit 30.</p>
        <div className="mt-3 flex gap-2">
          {(["insights", "explain", "quiz", "admin"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setOut(""); if (t === "insights") runInsights(); }}
              className={`rounded-full px-3 py-1 text-xs font-bold ${tab === t ? "bg-violet-600 text-white" : "bg-white/40"}`}>{t}</button>
          ))}
        </div>
      </div>
      {tab !== "insights" && (
        <div className="glass grid gap-2 p-4 md:grid-cols-3">
          {(tab === "explain" || tab === "quiz") && (
            <>
              <input className="glass-input" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              <input className="glass-input" placeholder="Topic *" value={topic} onChange={(e) => setTopic(e.target.value)} />
              <button onClick={tab === "explain" ? runExplain : runQuiz} disabled={busy} className="btn-primary disabled:opacity-50">{busy ? "..." : tab === "explain" ? "Explain" : "Generate Quiz"}</button>
            </>
          )}
          {tab === "admin" && (
            <>
              <input className="glass-input md:col-span-2" placeholder="e.g. Which fees are outstanding?" value={question} onChange={(e) => setQuestion(e.target.value)} />
              <button onClick={runAdmin} disabled={busy} className="btn-primary disabled:opacity-50">{busy ? "..." : "Ask"}</button>
            </>
          )}
        </div>
      )}
      {out && <pre className="glass overflow-x-auto whitespace-pre-wrap p-4 text-xs">{out}</pre>}
    </div>
  );
}
