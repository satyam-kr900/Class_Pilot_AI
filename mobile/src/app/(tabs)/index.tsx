import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useInstitute } from '../../hooks/useInstitute';
import { C, GlassCard, ScreenBg } from '../../components/ui';

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => new Date().toISOString().slice(0, 7) + '-01';

type Stats = {
  todayCollection: number;
  monthCollection: number;
  monthExpenses: number;
  pendingCount: number;
  pendingAmount: number;
  attendanceToday: string;
  studentCount: number;
};

export default function DashboardScreen() {
  const router = useRouter();
  const { active, activeId } = useInstitute();
  const [stats, setStats] = useState<Stats>({
    todayCollection: 0,
    monthCollection: 0,
    monthExpenses: 0,
    pendingCount: 0,
    pendingAmount: 0,
    attendanceToday: '—',
    studentCount: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    // Active institute scope — RLS bhi filter karta hai, par explicit eq se
    // doosre institute ka data dashboard me leak nahi hota. Column missing ho
    // (purana schema) to fallback bina filter ke.
    const scopeOrAll = async <T,>(
      table: string,
      cols: string,
      dateCol: string | null,
      dateFrom: string | null
    ): Promise<T[]> => {
      let q = supabase.from(table).select(cols);
      if (activeId) q = q.eq('institute_id', activeId);
      if (dateCol && dateFrom) q = q.gte(dateCol, dateFrom);
      const { data, error } = await q;
      if (!error) return (data ?? []) as T[];
      if (activeId && /institute_id/i.test(error.message)) {
        let fb = supabase.from(table).select(cols);
        if (dateCol && dateFrom) fb = fb.gte(dateCol, dateFrom);
        const retry = await fb;
        if (!retry.error) return (retry.data ?? []) as T[];
      }
      return [];
    };

    const list = await scopeOrAll<{ id: string; monthly_fee: number }>(
      'students',
      'id, monthly_fee',
      null,
      null
    );

    const monthPays = await scopeOrAll<{ student_id: string; amount: number; payment_date: string }>(
      'fee_payments',
      'student_id, amount, payment_date',
      'payment_date',
      monthStart()
    );

    const exps = await scopeOrAll<{ amount: number }>(
      'expenses',
      'amount',
      'expense_date',
      monthStart()
    );
    const monthExp = exps.reduce((s, e) => s + Number(e.amount || 0), 0);

    const att = await scopeOrAll<{ status: string; attendance_date: string }>(
      'attendance',
      'status, attendance_date',
      'attendance_date',
      today()
    );
    // gte(today) laate hain, par card sirf aaj ka dikhata hai.
    const attRows = att.filter((a) => a.attendance_date === today());

    const paidIds = new Set(monthPays.map((p) => p.student_id));
    const unpaid = list.filter((s) => !paidIds.has(s.id));

    setStats({
      todayCollection: monthPays
        .filter((p) => p.payment_date === today())
        .reduce((s, p) => s + Number(p.amount || 0), 0),
      monthCollection: monthPays.reduce((s, p) => s + Number(p.amount || 0), 0),
      monthExpenses: monthExp,
      pendingCount: unpaid.length,
      pendingAmount: unpaid.reduce((s, x) => s + Number(x.monthly_fee || 0), 0),
      attendanceToday: attRows.length
        ? `${attRows.filter((a) => a.status === 'present').length}/${attRows.length}`
        : '—',
      studentCount: list.length,
    });
  }, [activeId]);

  useEffect(() => {
    load();
  }, [load]);

  const cards: [string, string, string][] = [
    ['Aaj ki collection', `₹${stats.todayCollection}`, ''],
    ['Is mahine', `₹${stats.monthCollection}`, `Kharch ₹${stats.monthExpenses} • Net ₹${stats.monthCollection - stats.monthExpenses}`],
    ['Pending dues', `₹${stats.pendingAmount}`, `${stats.pendingCount} students`],
    ['Aaj attendance', stats.attendanceToday, `${stats.studentCount} students total`],
  ];

  const links: [string, string][] = [
    ['+ Student', '/(tabs)/students'],
    ['Attendance lo', '/(tabs)/attendance'],
    ['Fees lo', '/(tabs)/fees'],
    ['Reminders bhejo', '/communication'],
  ];

  return (
    <View style={{ flex: 1 }}>
      <ScreenBg />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 20 }}
          contentContainerStyle={{ paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        >
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: C.ink }}>
            {active?.institutes?.name ?? 'ClassPilot AI'}
          </Text>
          <Text style={{ marginTop: 2, fontSize: 12, color: C.muted }}>
            Aaj {today()} • Daily collection dashboard
          </Text>

          <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {cards.map(([t, v, s]) => (
              <View key={t} style={{ width: '48%' }}>
                <GlassCard>
                  <View style={{ padding: 14 }}>
                    <Text style={{ fontSize: 11, color: C.muted }}>{t}</Text>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: C.ink, marginTop: 4 }}>{v}</Text>
                    {!!s && <Text style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{s}</Text>}
                  </View>
                </GlassCard>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 12 }}>
            <GlassCard>
              <View style={{ padding: 8 }}>
                {links.map(([label, href]) => (
                  <TouchableOpacity
                    key={label}
                    onPress={() => router.push(href as never)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 13,
                      paddingHorizontal: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: 'rgba(255,255,255,0.5)',
                    }}
                  >
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: 'bold', color: C.ink }}>{label}</Text>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: C.teal }}>→</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </GlassCard>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
