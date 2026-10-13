"use client";
import Link from "next/link";

const ACTIONS = [
  { href: "/dashboard/students", icon: "🎓", label: "Add Student" },
  { href: "/dashboard/attendance", icon: "✅", label: "Mark Attendance" },
  { href: "/dashboard/fees", icon: "💰", label: "Collect Fee" },
  { href: "/dashboard/homework", icon: "📝", label: "Give Homework" },
];

/** Bade, ek-tap buttons — roz ka kaam 1 click me. Logic same, sirf rasta chhota. */
export default function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {ACTIONS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="glass-strong flex items-center gap-3 p-4 transition hover:scale-[1.02] active:scale-[0.98]"
        >
          <span className="text-2xl">{a.icon}</span>
          <span className="text-sm font-extrabold">{a.label}</span>
        </Link>
      ))}
    </div>
  );
}
