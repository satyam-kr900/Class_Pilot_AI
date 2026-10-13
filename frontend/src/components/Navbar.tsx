"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Navbar() {
  const path = usePathname();
  const router = useRouter();
  const hidden = path === "/login" || path === "/";
  if (hidden) return null;

  async function onLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-3 z-20 mx-auto max-w-6xl px-4">
      <div className="glass flex items-center justify-between px-5 py-3">
        <Link href="/dashboard" className="text-lg font-extrabold text-slate-800">
          ClassPilot <span className="text-red-600">AI</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/dashboard" className="btn-ghost !px-4 !py-2">Dashboard</Link>
          <button onClick={onLogout} className="btn-primary !px-4 !py-2">Logout</button>
        </nav>
      </div>
    </header>
  );
}
