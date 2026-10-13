import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useInstitute } from '../../hooks/useInstitute';
import { canManage } from '../../types/institute';
import { receiptMsg, shareViaWhatsApp } from '../../lib/share';
import { C, GlassCard, RowIcon, ScreenBg } from '../../components/ui';

type StudentRow = { id: string; name: string; batch: string | null; monthly_fee: number; guardian_phone?: string | null };
type Payment = {
  id: string;
  student_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  receipt_no?: string | null;
};

const METHODS = ['cash', 'upi', 'bank', 'other'] as const;

const monthStart = () => new Date().toISOString().slice(0, 7) + '-01';

export default function FeesScreen() {
  const { activeId, role, active } = useInstitute();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [collecting, setCollecting] = useState<string | null>(null);
  const [method, setMethod] = useState<(typeof METHODS)[number]>('cash');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: sData, error: sErr } = await supabase
      .from('students')
      .select('id, name, batch, monthly_fee, guardian_phone')
      .order('name');
    if (!sErr) setStudents((sData ?? []) as StudentRow[]);

    const { data: pData, error: pErr } = await supabase
      .from('fee_payments')
      .select('id, student_id, amount, payment_date, payment_method, receipt_no')
      .gte('payment_date', monthStart())
      .order('payment_date', { ascending: false })
      .limit(30);
    if (!pErr && pData) {
      setPayments(pData as Payment[]);
    } else if (pErr && /receipt_no/i.test(pErr.message)) {
      const retry = await supabase
        .from('fee_payments')
        .select('id, student_id, amount, payment_date, payment_method')
        .gte('payment_date', monthStart())
        .order('payment_date', { ascending: false })
        .limit(30);
      if (retry.data) setPayments(retry.data as Payment[]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const paidIds = new Set(payments.map((p) => p.student_id));
  const expected = students.reduce((s, r) => s + Number(r.monthly_fee || 0), 0);
  // Actual cash collected (payment rows ka sum) — monthly_fee sum nahi, taaki
  // partial/custom amount bhi sahi dikhe.
  const collected = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const pending = Math.max(0, expected - collected);

  async function collect(student: StudentRow) {
    if (!canManage(role)) {
      Alert.alert('No permission', 'Sirf owner/teacher/staff fees collect kar sakte hain.');
      return;
    }
    const amount = Number(student.monthly_fee || 0);
    if (!(amount > 0)) {
      Alert.alert('Invalid fee', 'Is student ki monthly fee 0 hai.');
      return;
    }
    setCollecting(student.id);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        Alert.alert('Login required', 'Please log in again.');
        return;
      }
      const receiptNo = 'R-' + Date.now().toString(36).toUpperCase();
      const full: Record<string, unknown> = {
        owner_id: userData.user.id,
        institute_id: activeId,
        student_id: student.id,
        amount,
        payment_method: method,
        receipt_no: receiptNo,
      };
      let { error } = await supabase.from('fee_payments').insert(full);
      if (error && /institute_id|receipt_no/i.test(error.message)) {
        const slim: Record<string, unknown> = {
          owner_id: userData.user.id,
          student_id: student.id,
          amount,
          payment_method: method,
        };
        ({ error } = await supabase.from('fee_payments').insert(slim));
      }
      if (error) {
        Alert.alert('Failed', error.message);
        return;
      }
      const instituteName = active?.institutes?.name ?? 'ClassPilot AI';
      const todayStr = new Date().toISOString().slice(0, 10);
      Alert.alert('Receipt ' + receiptNo, `₹${amount} (${method}) collected from ${student.name}.`, [
        { text: 'Done', onPress: () => load() },
        {
          text: 'Share receipt',
          onPress: async () => {
            await load();
            try {
              await shareViaWhatsApp(
                student.guardian_phone,
                receiptMsg(receiptNo, student.name, amount, todayStr, instituteName)
              );
            } catch {
              // share sheet closed — koi baat nahi
            }
          },
        },
      ]);
    } finally {
      setCollecting(null);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenBg />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 10 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: C.ink }}>Fees</Text>
          <Text style={{ marginTop: 2, fontSize: 12, color: C.muted }}>
            Is mahine ka collection • {role ?? 'role loading…'}
          </Text>

          <View style={{ marginTop: 10 }}>
            <GlassCard>
              <View style={{ flexDirection: 'row', padding: 20 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: C.muted }}>Expected</Text>
                  <Text style={{ fontSize: 22, fontWeight: 'bold', color: C.ink }}>₹{expected}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: C.muted }}>Collected</Text>
                  <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#149C73' }}>
                    ₹{collected}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: C.muted }}>Pending</Text>
                  <Text style={{ fontSize: 22, fontWeight: 'bold', color: C.coral }}>
                    ₹{pending}
                  </Text>
                </View>
              </View>
            </GlassCard>
          </View>

          <View style={{ marginTop: 10, flexDirection: 'row', gap: 8 }}>
            {METHODS.map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setMethod(m)}
                style={{
                  flex: 1,
                  borderRadius: 999,
                  alignItems: 'center',
                  paddingVertical: 9,
                  backgroundColor: method === m ? C.teal : 'rgba(255,255,255,0.4)',
                }}
              >
                <Text
                  style={{ fontSize: 12, fontWeight: 'bold', color: method === m ? '#fff' : C.ink }}
                >
                  {m.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            style={{ marginTop: 12 }}
            data={students}
            keyExtractor={(i) => i.id}
            onRefresh={onRefresh}
            refreshing={refreshing}
            contentContainerStyle={{ paddingBottom: 12 }}
            ListEmptyComponent={
              <Text style={{ marginTop: 16, textAlign: 'center', color: C.muted }}>
                Pehle students add karo.
              </Text>
            }
            renderItem={({ item }) => {
              const paid = paidIds.has(item.id);
              const busy = collecting === item.id;
              const receipt = payments.find((p) => p.student_id === item.id)?.receipt_no;
              return (
                <View
                  style={{
                    marginBottom: 10,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.55)',
                    backgroundColor: 'rgba(255,255,255,0.35)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                  }}
                >
                  <RowIcon name="wallet-outline" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: C.ink }}>{item.name}</Text>
                    <Text style={{ fontSize: 11, color: C.muted }}>
                      ₹{item.monthly_fee}/mo • {paid ? `Paid${receipt ? ` • ${receipt}` : ''}` : 'Due'}
                    </Text>
                  </View>
                  {paid ? (
                    <View
                      style={{ borderRadius: 999, backgroundColor: '#D9F2E7', paddingHorizontal: 12, paddingVertical: 6 }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#0E7A55' }}>✓ Paid</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => collect(item)}
                      disabled={busy}
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        backgroundColor: busy ? '#9FB3C8' : C.teal,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#fff' }}>
                        {busy ? '…' : 'Collect'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
