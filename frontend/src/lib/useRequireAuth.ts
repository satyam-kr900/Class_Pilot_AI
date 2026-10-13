"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function useRequireAuth() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }
      setUserId(data.user.id);
      setChecking(false);
    })();
  }, [router]);

  return { userId, checking };
}

export function monthStart(): string {
  return new Date().toISOString().slice(0, 7) + "-01";
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
