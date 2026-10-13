export default function GlassCard({
  title,
  value,
  subtitle,
  accent = "#DC2626",
}: {
  title: string;
  value: string;
  subtitle?: string;
  accent?: string;
}) {
  return (
    <div className="glass p-5">
      <div className="flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-full border border-white/40 bg-white/25"
          style={{ boxShadow: `0 0 0 4px ${accent}22` }}
        />
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      </div>
      <p className="mt-3 text-3xl font-extrabold text-slate-800">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}
