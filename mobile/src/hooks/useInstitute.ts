import { useCallback, useEffect, useState } from 'react';
import {
  getActiveInstituteId,
  getMyMemberships,
  setActiveInstituteId,
} from '../services/institute.service';
import type { InstituteMember, InstituteRole } from '../types/institute';

/**
 * Active institute + role — ClassPilot screens ka shared hook.
 * Migration na chali ho (table missing) to empty state, crash nahi.
 */
export function useInstitute() {
  const [memberships, setMemberships] = useState<InstituteMember[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getMyMemberships();
      setMemberships(rows);
      const saved = await getActiveInstituteId();
      if (saved && rows.some((r) => r.institute_id === saved)) {
        setActiveId(saved);
      } else if (rows.length > 0) {
        setActiveId(rows[0].institute_id);
        await setActiveInstituteId(rows[0].institute_id);
      } else {
        setActiveId(null);
      }
    } catch {
      setMemberships([]);
      setActiveId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setActive = useCallback(async (id: string) => {
    setActiveId(id);
    await setActiveInstituteId(id);
  }, []);

  const active = memberships.find((m) => m.institute_id === activeId) ?? null;
  const role: InstituteRole | null = active ? active.role : null;

  return { memberships, active, activeId, role, loading, refresh, setActive };
}
