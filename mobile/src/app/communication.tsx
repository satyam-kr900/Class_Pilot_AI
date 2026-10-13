import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useInstitute } from '../hooks/useInstitute';
import { canManage } from '../types/institute';
import { feeReminderMsg, shareViaWhatsApp } from '../lib/share';
import { C, GlassCard, GlassInput, PrimaryButton, ScreenBg } from '../components/ui';

type Announcement = { id: string; title: string; body: string; audience: string; created_at: string };
type Defaulter = { id: string; name: string; monthly_fee: number; guardian_phone: string | null };

export default function CommunicationScreen() {
  const { activeId, role, active } = useInstitute();
  const [notices, setNotices] = useState<Announcement[]>([]);
  const [defaulters, setDefaulters] = useState<Defaulter[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: n } = await supabase
      .from('announcements')
      .select('id, title, body, audience, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    if (n) setNotices(n as Announcement[]);

    const monthStart = new Date().toISOString().slice(0, 7) + '-01';
    const { data: s } = await supabase.from('students').select('id, name, monthly_fee, guardian_phone');
    const { data: p } = await supabase
      .from('fee_payments')
      .select('student_id')
      .gte('payment_date', monthStart);
    if (s) {
      const paid = new Set(((p ?? []) as { student_id: string }[]).map((x) => x.student_id));
      setDefaulters(
        (s as Defaulter[]).filter((x) => !paid.has(x.id) && Number(x.monthly_fee || 0) > 0)
      );
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function postNotice() {
    if (!canManage(role)) {
      Alert.alert('No permission', 'Sirf owner/teacher/staff notice bhej sakte hain.');
      return;
    }
    if (!title.trim() || !body.trim()) {
      Alert.alert('Error', 'Title aur message likho.');
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        institute_id: activeId,
        title: title.trim(),
        body: body.trim(),
        audience: 'all',
      };
      const { error } = await supabase.from('announcements').insert(payload);
      if (error) {
        Alert.alert('Failed', error.message);
        return;
      }
      setTitle('');
      setBody('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function shareNotice(item: Announcement) {
    try {
      await shareViaWhatsApp(null, `📢 ${active?.institutes?.name ?? 'ClassPilot AI'}\n*${item.title}*\n${item.body}`);
    } catch {
      // closed
    }
  }

  async function remind(d: Defaulter) {
    try {
      await shareViaWhatsApp(
        d.guardian_phone,
        feeReminderMsg(d.name, Number(d.monthly_fee || 0), active?.institutes?.name ?? 'ClassPilot AI')
      );
    } catch {
      // closed
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenBg />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 10 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: C.ink }}>Messages</Text>
          <Text style={{ marginTop: 2, fontSize: 12, color: C.muted }}>
            Notices + fee reminders — WhatsApp share
          </Text>

          <FlatList
            style={{ marginTop: 12 }}
            data={[{ kind: 'form' } as const, { kind: 'def' } as const, ...notices.map((n) => ({ kind: 'note', n }) as const)]}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item }) => {
              if (item.kind === 'form') {
                return (
                  <View style={{ marginBottom: 12 }}>
                    <GlassCard>
                      <View style={{ padding: 16 }}>
                        <Text style={{ fontSize: 15, fontWeight: 'bold', color: C.ink }}>New notice</Text>
                        <GlassInput value={title} onChangeText={setTitle} placeholder="Title" />
                        <GlassInput value={body} onChangeText={setBody} placeholder="Message" />
                        <PrimaryButton title={busy ? 'Sending…' : 'Post notice'} onPress={postNotice} disabled={busy} />
                      </View>
                    </GlassCard>
                  </View>
                );
              }
              if (item.kind === 'def') {
                if (defaulters.length === 0) return null;
                return (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: C.ink, marginBottom: 6 }}>
                      Fee reminders ({defaulters.length} pending)
                    </Text>
                    {defaulters.map((d) => (
                      <View
                        key={d.id}
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
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: 'bold', color: C.ink }}>{d.name}</Text>
                          <Text style={{ fontSize: 11, color: C.muted }}>₹{d.monthly_fee} pending</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => remind(d)}
                          style={{ borderRadius: 999, backgroundColor: '#1FA855', paddingHorizontal: 14, paddingVertical: 8 }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#fff' }}>Remind</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                );
              }
              const n = item.n;
              return (
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
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: C.ink }}>{n.title}</Text>
                    <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{n.body}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => shareNotice(n)}
                    style={{
                      height: 36,
                      width: 36,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 18,
                      backgroundColor: '#E4F5EC',
                    }}
                  >
                    <Ionicons name="share-social-outline" size={17} color="#1FA855" />
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
