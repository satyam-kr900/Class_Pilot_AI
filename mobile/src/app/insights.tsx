import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { C, GlassCard, ScreenBg } from '../components/ui';

/**
 * ClassPilot Intelligence (rule-based, Phase 1):
 * real data se collection summary, defaulters, low-attendance alerts.
 * Koi external AI API nahi — figures invent nahi hote, sirf DB se.
 */
export default function InsightsScreen() {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const out: string[] = [];
      const monthStart = new Date().toISOString().slice(0, 7) + '-01';
      const thirtyAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

      const { data: students, error: sErr } = await supabase
        .from('students')
        .select('id, name, monthly_fee');
      if (sErr) throw sErr;
      const list = (students ?? []) as { id: string; name: string; monthly_fee: number }[];

      const { data: pays } = await supabase
        .from('fee_payments')
        .select('student_id, amount, payment_date')
        .gte('payment_date', monthStart);
      const monthPays = (pays ?? []) as { student_id: string; amount: number; payment_date: string }[];
      const collected = monthPays.reduce((s, p) => s + Number(p.amount || 0), 0);
      const paidIds = new Set(monthPays.map((p) => p.student_id));
      const unpaid = list.filter((s) => !paidIds.has(s.id) && Number(s.monthly_fee || 0) > 0);
      const due = unpaid.reduce((s, x) => s + Number(x.monthly_fee || 0), 0);

      out.push(`Is mahine ₹${collected} collect hua, ₹${due} abhi pending hai (${unpaid.length} students).`);
      if (unpaid.length > 0) {
        const top = [...unpaid].sort((a, b) => Number(b.monthly_fee) - Number(a.monthly_fee)).slice(0, 3);
        out.push(`Follow-up pehle inse karo: ${top.map((t) => `${t.name} (₹${t.monthly_fee})`).join(', ')}.`);
      } else if (list.length > 0) {
        out.push('100% collection! Sab fees clear hai. 🎉');
      }

      const { data: att } = await supabase
        .from('attendance')
        .select('student_id, status, attendance_date')
        .gte('attendance_date', thirtyAgo);
      const rows = (att ?? []) as { student_id: string; status: string }[];
      if (rows.length > 0) {
        const byStudent = new Map<string, { p: number; t: number }>();
        for (const r of rows) {
          const e = byStudent.get(r.student_id) ?? { p: 0, t: 0 };
          e.t += 1;
          if (r.status === 'present') e.p += 1;
          byStudent.set(r.student_id, e);
        }
        const low: string[] = [];
        for (const [sid, e] of byStudent) {
          if (e.t >= 3 && e.p / e.t < 0.75) {
            low.push(sid);
          }
        }
        if (low.length > 0) {
          const names = new Map(list.map((s) => [s.id, s.name]));
          out.push(
            `Low attendance alert (${low.length}): ${low
              .slice(0, 5)
              .map((id) => names.get(id) ?? id.slice(0, 6))
              .join(', ')}. Guardians ko message bhejo.`
          );
        } else {
          out.push('Attendance healthy hai — 30 din me koi student 75% se neeche nahi.');
        }
      } else {
        out.push('Pichhle 30 din ka attendance data nahi hai — pehle attendance lo.');
      }

      if (list.length === 0) out.push('Students add karo taaki insights ban sakein.');
      setLines(out);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Load failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={{ flex: 1 }}>
      <ScreenBg />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} contentContainerStyle={{ paddingBottom: 30 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: C.ink }}>AI Insights</Text>
          <Text style={{ marginTop: 2, fontSize: 12, color: C.muted }}>
            Tumhare real data se — kuch invent nahi hota
          </Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {loading ? (
              <GlassCard>
                <Text style={{ padding: 18, fontSize: 13, color: C.muted }}>Calculating…</Text>
              </GlassCard>
            ) : (
              lines.map((l, i) => (
                <GlassCard key={i}>
                  <Text style={{ padding: 16, fontSize: 13, lineHeight: 20, color: C.ink }}>{l}</Text>
                </GlassCard>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
