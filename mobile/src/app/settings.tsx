import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { signOut } from '../lib/auth';
import { useInstitute } from '../hooks/useInstitute';
import { createInstitute } from '../services/institute.service';
import { C, GlassCard, GlassInput, PrimaryButton, ScreenBg } from '../components/ui';

export default function SettingsScreen() {
  const router = useRouter();
  const { memberships, activeId, role, loading, refresh, setActive } = useInstitute();
  const [instName, setInstName] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<{ table: string; ok: boolean; msg: string }[] | null>(null);
  const [checking, setChecking] = useState(false);

  async function checkDb() {
    setChecking(true);
    const tables = ['institutes', 'institute_members', 'students', 'batches', 'fee_payments', 'attendance'];
    const out: { table: string; ok: boolean; msg: string }[] = [];
    for (const t of tables) {
      const { error } = await supabase.from(t).select('id').limit(1);
      out.push({ table: t, ok: !error, msg: error ? error.message : 'OK' });
    }
    setDbStatus(out);
    setChecking(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user?.email ?? 'Guest'));
  }, []);

  async function handleCreateInstitute() {
    if (!instName.trim()) {
      Alert.alert('Error', 'Institute name likho.');
      return;
    }
    setBusy(true);
    try {
      await createInstitute(instName);
      setInstName('');
      await refresh();
      Alert.alert('Success', 'Institute ban gaya.');
    } catch (e) {
      Alert.alert('Failed', e instanceof Error ? e.message : 'Create failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await signOut();
    router.replace('/(auth)/login');
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenBg />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} contentContainerStyle={{ paddingBottom: 30 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: C.ink }}>Settings</Text>
          <Text style={{ marginTop: 2, fontSize: 12, color: C.muted }}>
            {email ?? ''}{role ? ` • ${role}` : ''}
          </Text>

          <View style={{ marginTop: 12 }}>
            <GlassCard>
              <View style={{ padding: 16 }}>
                <Text style={{ fontSize: 15, fontWeight: 'bold', color: C.ink }}>Institute</Text>
                {loading ? (
                  <Text style={{ marginTop: 6, fontSize: 12, color: C.muted }}>Loading…</Text>
                ) : memberships.length === 0 ? (
                  <Text style={{ marginTop: 6, fontSize: 12, color: C.muted }}>
                    Koi institute nahi — neeche se banao. (Migration SQL chali hai na?)
                  </Text>
                ) : (
                  memberships.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => setActive(m.institute_id)}
                      style={{
                        marginTop: 8,
                        borderRadius: 14,
                        padding: 12,
                        backgroundColor:
                          m.institute_id === activeId ? 'rgba(236,72,153,0.15)' : 'rgba(255,255,255,0.3)',
                        borderWidth: m.institute_id === activeId ? 1.5 : 1,
                        borderColor: m.institute_id === activeId ? C.teal : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: C.ink }}>
                        {m.institutes?.name ?? m.institute_id.slice(0, 8)}
                      </Text>
                      <Text style={{ fontSize: 11, color: C.muted }}>
                        {m.role} • {m.institutes?.plan ?? 'free'}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
                <GlassInput value={instName} onChangeText={setInstName} placeholder="New institute name" />
                <PrimaryButton
                  title={busy ? 'Please wait…' : '+ Create institute'}
                  onPress={handleCreateInstitute}
                  disabled={busy}
                />
              </View>
            </GlassCard>
          </View>

          <TouchableOpacity
            onPress={() => router.push('/batches' as never)}
            style={{
              marginTop: 12,
              borderRadius: 999,
              alignItems: 'center',
              paddingVertical: 13,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.6)',
              backgroundColor: 'rgba(255,255,255,0.3)',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: C.teal }}>Manage batches →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogout}
            style={{
              marginTop: 14,
              borderRadius: 999,
              alignItems: 'center',
              paddingVertical: 13,
              backgroundColor: '#FDEDEA',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: C.coral }}>Logout</Text>
          </TouchableOpacity>

          <View style={{ marginTop: 12 }}>
            <GlassCard>
              <View style={{ padding: 16 }}>
                <Text style={{ fontSize: 15, fontWeight: 'bold', color: C.ink }}>
                  Database check
                </Text>
                <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  Kaunsi table ready hai, kaunsi missing — yahan dikhega.
                </Text>
                <PrimaryButton
                  title={checking ? 'Checking…' : 'Check database'}
                  onPress={checkDb}
                  disabled={checking}
                />
                {dbStatus?.map((r) => (
                  <View
                    key={r.table}
                    style={{
                      marginTop: 8,
                      borderRadius: 12,
                      padding: 10,
                      backgroundColor: r.ok ? '#E7F7F2' : '#FDEDEA',
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: C.ink }}>
                      {r.ok ? '✓' : '✗'} {r.table}
                    </Text>
                    {!r.ok && (
                      <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{r.msg}</Text>
                    )}
                  </View>
                ))}
              </View>
            </GlassCard>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
