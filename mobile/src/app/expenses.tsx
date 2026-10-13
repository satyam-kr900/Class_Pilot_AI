import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { getActiveInstituteId } from '../services/institute.service';
import { C, GlassCard, GlassInput, PrimaryButton, RowIcon, ScreenBg } from '../components/ui';

type Expense = { id: string; title: string; amount: number; category: string; expense_date: string };
const CATS = ['rent', 'salary', 'utilities', 'marketing', 'material', 'other'] as const;

export default function ExpensesScreen() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState<(typeof CATS)[number]>('other');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('expenses')
      .select('id, title, amount, category, expense_date')
      .order('expense_date', { ascending: false })
      .limit(50);
    if (!error && data) setRows(data as Expense[]);
    else if (error) Alert.alert('Error', error.message);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const monthStart = new Date().toISOString().slice(0, 7) + '-01';
  const monthTotal = rows
    .filter((r) => r.expense_date >= monthStart)
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  async function add() {
    const amt = Number(amount);
    if (!title.trim() || !Number.isFinite(amt) || !(amt > 0)) {
      Alert.alert('Error', 'Title aur valid amount likho.');
      return;
    }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        Alert.alert('Login required', 'Please log in again.');
        return;
      }
      const instituteId = await getActiveInstituteId().catch(() => null);
      const { error } = await supabase.from('expenses').insert({
        owner_id: u.user.id,
        institute_id: instituteId,
        title: title.trim(),
        amount: amt,
        category: cat,
      });
      if (error) {
        Alert.alert('Failed', error.message);
        return;
      }
      setTitle('');
      setAmount('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenBg />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 10 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: C.ink }}>Expenses</Text>
          <Text style={{ marginTop: 2, fontSize: 12, color: C.muted }}>
            Is mahine: ₹{monthTotal}
          </Text>
          <View style={{ marginTop: 10 }}>
            <GlassCard>
              <View style={{ padding: 16 }}>
                <GlassInput value={title} onChangeText={setTitle} placeholder="Kis cheez par? (e.g. Room rent)" />
                <GlassInput value={amount} onChangeText={setAmount} placeholder="Amount (₹)" keyboardType="decimal-pad" />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {CATS.map((c) => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setCat(c)}
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        backgroundColor: cat === c ? C.teal : 'rgba(255,255,255,0.4)',
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: cat === c ? '#fff' : C.ink }}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <PrimaryButton title={busy ? 'Saving…' : '+ Add expense'} onPress={add} disabled={busy} />
              </View>
            </GlassCard>
          </View>
          <FlatList
            style={{ marginTop: 12 }}
            data={rows}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              <Text style={{ marginTop: 16, textAlign: 'center', color: C.muted }}>Koi kharcha nahi.</Text>
            }
            renderItem={({ item }) => (
              <View
                style={{
                  marginBottom: 8,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.55)',
                  backgroundColor: 'rgba(255,255,255,0.35)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 12,
                }}
              >
                <RowIcon name="receipt-outline" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: C.ink }}>{item.title}</Text>
                  <Text style={{ fontSize: 11, color: C.muted }}>
                    {item.category} • {item.expense_date}
                  </Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: 'bold', color: C.coral }}>₹{item.amount}</Text>
              </View>
            )}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
