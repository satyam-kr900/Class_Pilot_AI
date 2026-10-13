"use client";
import { useInstitute } from "@/lib/useInstitute";

export default function InstituteSwitcher() {
  const { memberships, instituteId, loading, select } = useInstitute();

  if (loading) return <div className="glass px-4 py-2 text-xs">Institute loading...</div>;
  if (memberships.length === 0)
    return (
      <div className="glass px-4 py-2 text-xs text-slate-500">
        No institute yet — login ke baad auto-banta hai (/login se verify).
      </div>
    );

  return (
    <div className="glass flex min-w-0 items-center gap-2 px-4 py-2">
      <span className="shrink-0 text-xs font-bold text-slate-500">Institute:</span>
      <select
        className="min-w-0 flex-1 rounded-xl border bg-white px-2 py-1.5 text-sm font-bold"
        value={instituteId ?? ""}
        onChange={(e) => select(e.target.value)}
      >
        {memberships.map((m) => (
          <option key={m.institute_id} value={m.institute_id}>
            {m.institutes?.name ?? m.institute_id.slice(0, 8)} ({m.role})
          </option>
        ))}
      </select>
    </div>
  );
}
