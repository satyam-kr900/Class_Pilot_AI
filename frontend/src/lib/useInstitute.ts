"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { myInstitutes, type Membership } from "@/lib/api";

const KEY = "cp_institute_id";

export function useInstitute() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [instituteId, setInstituteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          setLoading(false);
          return;
        }
        const res = await myInstitutes(token);
        setMemberships(res.memberships ?? []);
        const saved = localStorage.getItem(KEY);
        const valid = (res.memberships ?? []).some((m) => m.institute_id === saved);
        const pick = valid
          ? saved!
          : res.memberships[0]?.institute_id ?? null;
        if (pick) localStorage.setItem(KEY, pick);
        setInstituteId(pick);
      } catch {
        // Backend down ho to switcher empty rahega — RLS reads still work.
        const saved = localStorage.getItem(KEY);
        setInstituteId(saved);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function select(id: string) {
    localStorage.setItem(KEY, id);
    setInstituteId(id);
    window.location.reload();
  }

  const role = memberships.find((m) => m.institute_id === instituteId)?.role ?? memberships[0]?.role ?? null;

  return { memberships, instituteId, loading, select, role };
}

export function getSelectedInstituteId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}
