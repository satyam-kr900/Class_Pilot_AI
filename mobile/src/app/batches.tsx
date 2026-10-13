import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useInstitute } from '../hooks/useInstitute';
import { canManage } from '../types/institute';
import { createBatch, getBatches } from '../services/institute.service';
import type { Batch } from '../types/institute';
import { C, GlassCard, GlassInput, PrimaryButton, RowIcon, ScreenBg } from '../components/ui';

export default function BatchesScreen() {
  const { activeId, role } = useInstitute();
  const [batches, setBatches] = useState<(Batch & { count?: number })[]>([]);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [members, setMembers] = useState<{ student_id: string; students: { name: string } }[]>([]);
  const [allStudents, setAllStudents] = useState<{ id: string; name: string }[]>([]);

  const load = useCallback(async () => {
    if (!activeId) {
      setBatches([]);
      return;
    }
    try {
      const list = await getBatches(activeId);
      const withCounts = await Promise.all(
        list.map(async (b) => {
          const { count } = await supabase
            .from('batch_students')
            .select('*', { count: 'exact', head: true })
            .eq('batch_id', b.id);
          return { ...b, count: count ?? 0 };
        })
      );
      setBatches(withCounts);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Load failed.');
    }
    const { data: s } = await supabase.from('students').select('id, name').order('name');
    if (s) setAllStudents(s as { id: string; name: string }[]);
  }, [activeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!activeId || !name.trim()) return;
    if (!canManage(role)) {
      Alert.alert('No permission', 'Sirf owner/teacher/staff batch bana sakte hain.');
      return;
    }
    setBusy(true);
    try {
      await createBatch(activeId, { name, subject });
      setName('');
      setSubject('');
      await load();
    } catch (e) {
      Alert.alert('Failed', e instanceof Error ? e.message : 'Create failed.');
    } finally {
      setBusy(false);
    }
  }

  async function openBatch(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    const { data } = await supabase
      .from('batch_students')
      .select('student_id, students(name)')
      .eq('batch_id', id);
    if (data) setMembers(data as unknown as { student_id: string; students: { name: string } }[]);
  }

  async function toggleMember(batchId: string, studentId: string, enrolled: boolean) {
    if (enrolled) {
      await supabase.from('batch_students').delete().eq('batch_id', batchId).eq('student_id', studentId);
    } else {
      await supabase.from('batch_students').insert({ batch_id: batchId, student_id: studentId });
    }
    await openBatchRefresh(batchId);
    await load();
  }

  async function openBatchRefresh(batchId: string) {
    const { data } = await supabase
      .from('batch_students')
      .select('student_id, students(name)')
      .eq('batch_id', batchId);
    if (data) setMembers(data as unknown as { student_id: string; students: { name: string } }[]);
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenBg />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 10 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: C.ink }}>Batches</Text>
          <Text style={{ marginTop: 2, fontSize: 12, color: C.muted }}>
            Classes, subjects, student assignment
          </Text>
          <View style={{ marginTop: 10 }}>
            <GlassCard>
              <View style={{ padding: 16 }}>
                <GlassInput value={name} onChangeText={setName} placeholder="Batch name (e.g. 10th-A)" />
                <GlassInput value={subject} onChangeText={setSubject} placeholder="Subject (optional)" />
                <PrimaryButton title={busy ? 'Saving…' : '+ Add batch'} onPress={add} disabled={busy} />
              </View>
            </GlassCard>
          </View>
          <FlatList
            style={{ marginTop: 12 }}
            data={batches}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              <Text style={{ marginTop: 16, textAlign: 'center', color: C.muted }}>
                {activeId ? 'Koi batch nahi — upar se banao.' : 'Pehle Settings me institute banao/select karo.'}
              </Text>
            }
            renderItem={({ item }) => {
              const open = openId === item.id;
              const enrolled = new Set(members.map((m) => m.student_id));
              return (
                <View
                  style={{
                    marginBottom: 10,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.55)',
                    backgroundColor: 'rgba(255,255,255,0.35)',
                    padding: 12,
                  }}
                >
                  <TouchableOpacity onPress={() => openBatch(item.id)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <RowIcon name="book-outline" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: 'bold', color: C.ink }}>{item.name}</Text>
                      <Text style={{ fontSize: 11, color: C.muted }}>
                        {[item.subject, `${item.count ?? 0} students`].filter(Boolean).join(' • ')}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: C.teal }}>{open ? '−' : '+'}</Text>
                  </TouchableOpacity>
                  {open && (
                    <View style={{ marginTop: 8 }}>
                      {allStudents.map((s) => {
                        const on = enrolled.has(s.id);
                        return (
                          <TouchableOpacity
                            key={s.id}
                            onPress={() => toggleMember(item.id, s.id, on)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingVertical: 8,
                              borderTopWidth: 1,
                              borderTopColor: 'rgba(255,255,255,0.5)',
                            }}
                          >
                            <View
                              style={{
                                height: 22,
                                width: 22,
                                borderRadius: 11,
                                marginRight: 10,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: on ? C.teal : 'rgba(255,255,255,0.5)',
                                borderWidth: 1,
                                borderColor: on ? C.teal : C.muted,
                              }}
                            >
                              {on && <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✓</Text>}
                            </View>
                            <Text style={{ fontSize: 13, color: C.ink }}>{s.name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                      {allStudents.length === 0 && (
                        <Text style={{ fontSize: 12, color: C.muted }}>Pehle students add karo.</Text>
                      )}
                    </View>
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
