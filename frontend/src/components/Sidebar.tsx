"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useInstitute } from "@/lib/useInstitute";

const STAFF_LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/admin", label: "🛠️ Admin" },
  { href: "/dashboard/students", label: "Students" },
  { href: "/dashboard/batches", label: "Batches" },
  { href: "/dashboard/timetable", label: "Timetable" },
  { href: "/dashboard/attendance", label: "Attendance" },
  { href: "/dashboard/homework", label: "Homework" },
  { href: "/dashboard/materials", label: "Materials" },
  { href: "/dashboard/exams", label: "Exams" },
  { href: "/dashboard/fees", label: "Fees" },
  { href: "/dashboard/enquiries", label: "Enquiries" },
  { href: "/dashboard/notifications", label: "Notifications" },
  { href: "/dashboard/ai", label: "AI Workspace" },
  { href: "/dashboard/subscription", label: "Subscription" },
];

const LEARNER_LINKS = [
  { href: "/dashboard", label: "My Learning" },
  { href: "/dashboard/homework", label: "Homework" },
  { href: "/dashboard/materials", label: "Materials" },
  { href: "/dashboard/exams", label: "Results" },
  { href: "/dashboard/notifications", label: "Notices" },
];

export default function Sidebar() {
  const path = usePathname();
  const { role } = useInstitute();
  const links = role === "student" || role === "parent" ? LEARNER_LINKS : STAFF_LINKS;
  return (
    <aside className="glass w-full shrink-0 p-3 lg:w-56">
      <div className="flex gap-2 overflow-x-auto lg:flex-col">
        {links.map((l) => {
          const active = path === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
                active
                  ? "bg-red-500/90 text-white shadow-lg"
                  : "bg-white/20 text-slate-700 hover:bg-white/40"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
