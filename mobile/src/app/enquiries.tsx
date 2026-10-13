import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { getActiveInstituteId } from '../services/institute.service';
import { C, GlassCard, GlassInput, PrimaryButton, RowIcon, ScreenBg } from '../components/ui';

type Enquiry = {
  id: string;
  name: string;
  phone: string | null;
  course: string | null;
  status: string;
  note: string | null;
};

const NEXT: Record<string, string> = { new: 'followup', followup: 'admitted', admitted: 'admitted', dropped: 'new' };
const NEXT_LABEL: Record<string, string> = { new: 'Follow-up →', followup: 'Admit →', admitted: 'Admitted ✓', dropped: 'Reopen' };

export default function EnquiriesScreen() {
  const [rows, setRows] = useState<Enquiry[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [course, setCourse] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('enquiries')
      .select('id, name, phone, course, status, note')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) setRows(data as Enquiry[]);
    else if (error) Alert.alert('Error', error.message);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!name.trim()) {
      Alert.alert('Error', 'Naam likho.');
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
      const { error } = await supabase.from('enquiries').insert({
        owner_id: u.user.id,
        institute_id: instituteId,
        name: name.trim(),
        phone: phone.trim() || null,
        course: course.trim() || null,
      });
      if (error) {
        Alert.alert('Failed', error.message);
        return;
      }
      setName('');
      setPhone('');
      setCourse('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function advance(item: Enquiry) {
    const next = NEXT[item.status] ?? 'new';
    if (next === 'admitted' && item.status !== 'admitted') {
      // Student banao + enquiry admitted.
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const instituteId = await getActiveInstituteId().catch(() => null);
      const { error: sErr } = await supabase.from('students').insert({
        owner_id: u.user.id,
        institute_id: instituteId,
        name: item.name,
        batch: item.course,
        monthly_fee: 0,
        guardian_phone: item.phone,
      });
      if (sErr) {
        Alert.alert('Student nahi bana', sErr.message);
        return;
      }
    }
    const { error } = await supabase.from('enquiries').update({ status: next }).eq('id', item.id);
    if (!error) {
      await load();
      if (next === 'admitted') Alert.alert('Admitted!', `${item.name} ab student hai. Fees screen me fee set karo.`);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenBg />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 10 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: C.ink }}>Enquiries</Text>
          <Text style={{ marginTop: 2, fontSize: 12, color: C.muted }}>
            Admission leads • {rows.filter((r) => r.status !== 'admitted' && r.status !== 'dropped').length} active
          </Text>
          <View style={{ marginTop: 10 }}>
            <GlassCard>
              <View style={{ padding: 16 }}>
                <GlassInput value={name} onChangeText={setName} placeholder="Naam *" />
                <GlassInput value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" />
                <GlassInput value={course} onChangeText={setCourse} placeholder="Course/Batch" />
                <PrimaryButton title={busy ? 'Saving…' : '+ Add enquiry'} onPress={add} disabled={busy} />
              </View>
            </GlassCard>
          </View>
          <FlatList
            style={{ marginTop: 12 }}
            data={rows}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              <Text style={{ marginTop: 16, textAlign: 'center', color: C.muted }}>Koi enquiry nahi.</Text>
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
                <RowIcon name="call-outline" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: C.ink }}>{item.name}</Text>
                  <Text style={{ fontSize: 11, color: C.muted }}>
                    {[item.course, item.phone, item.status].filter(Boolean).join(' • ')}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => advance(item)}
                  disabled={item.status === 'admitted'}
                  style={{
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    backgroundColor: item.status === 'admitted' ? '#D9F2E7' : C.teal,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: 'bold',
                      color: item.status === 'admitted' ? '#0E7A55' : '#fff',
                    }}
                  >
                    {NEXT_LABEL[item.status] ?? item.status}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
