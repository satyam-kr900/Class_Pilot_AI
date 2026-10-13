import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useInstitute } from '../../hooks/useInstitute';
import { getBatches } from '../../services/institute.service';
import type { Batch } from '../../types/institute';
import { canManage } from '../../types/institute';
import { C, ScreenBg } from '../../components/ui';

type StudentRow = { id: string; name: string; batch: string | null };

const today = () => new Date().toISOString().slice(0, 10);

export default function AttendanceScreen() {
  const { activeId, role, loading: instLoading } = useInstitute();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: sData, error: sErr } = await supabase
      .from('students')
      .select('id, name, batch')
      .order('name');
    if (sErr) {
      Alert.alert('Error', sErr.message);
      return;
    }
    let rows = (sData ?? []) as StudentRow[];

    if (batchId && activeId) {
      const { data: links } = await supabase
        .from('batch_students')
        .select('student_id')
        .eq('batch_id', batchId);
      if (links) {
        const ids = new Set(links.map((l: { student_id: string }) => l.student_id));
        rows = rows.filter((r) => ids.has(r.id));
      }
    }
    setStudents(rows);

    const { data: att } = await supabase
      .from('attendance')
      .select('student_id, status')
      .eq('attendance_date', today());
    if (att) {
      setPresent(
        new Set(
          att
            .filter((a: { status: string }) => a.status === 'present')
            .map((a: { student_id: string }) => a.student_id)
        )
      );
    }

    if (activeId) {
      try {
        setBatches(await getBatches(activeId));
      } catch {
        setBatches([]);
      }
    }
  }, [batchId, activeId]);

  useEffect(() => {
    if (!instLoading) load();
  }, [instLoading, load]);

  const visibleIds = new Set(students.map((s) => s.id));
  const presentVisible = [...present].filter((id) => visibleIds.has(id)).length;
  const pct = students.length ? Math.round((presentVisible / students.length) * 100) : 0;

  async function save() {
    if (!canManage(role)) {
      Alert.alert('No permission', 'Sirf owner/teacher/staff attendance le sakte hain.');
      return;
    }
    if (students.length === 0) return;
    setSaving(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        Alert.alert('Login required', 'Please log in again.');
        return;
      }
      const rows = students.map((s) => ({
        owner_id: userData.user!.id,
        institute_id: activeId,
        batch_id: batchId,
        student_id: s.id,
        attendance_date: today(),
        status: present.has(s.id) ? 'present' : 'absent',
      }));
      let { error } = await supabase
        .from('attendance')
        .upsert(rows, { onConflict: 'student_id,attendance_date' });
      if (error && /institute_id|batch_id/i.test(error.message)) {
        const legacy = rows.map(({ student_id, attendance_date, status, owner_id }) => ({
          owner_id,
          student_id,
          attendance_date,
          status,
        }));
        ({ error } = await supabase
          .from('attendance')
          .upsert(legacy, { onConflict: 'student_id,attendance_date' }));
      }
      if (error) {
        Alert.alert('Save failed', error.message);
        return;
      }
      Alert.alert('Saved', `${presentVisible}/${students.length} present (${today()})`);
    } finally {
      setSaving(false);
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
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: C.ink }}>
            Attendance — {today()}
          </Text>
          <Text style={{ marginTop: 2, fontSize: 12, color: C.muted }}>
            {presentVisible}/{students.length} present • {pct}%{role ? ` • ${role}` : ''}
          </Text>

          {batches.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setBatchId(null)}
                  style={{
                    borderRadius: 999,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    backgroundColor: batchId === null ? C.teal : 'rgba(255,255,255,0.4)',
                  }}
                >
                  <Text
                    style={{ fontSize: 12, fontWeight: 'bold', color: batchId === null ? '#fff' : C.ink }}
                  >
                    All
                  </Text>
                </TouchableOpacity>
                {batches.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    onPress={() => setBatchId(b.id)}
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      backgroundColor: batchId === b.id ? C.teal : 'rgba(255,255,255,0.4)',
                    }}
                  >
                    <Text
                      style={{ fontSize: 12, fontWeight: 'bold', color: batchId === b.id ? '#fff' : C.ink }}
                    >
                      {b.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          <FlatList
            style={{ marginTop: 10 }}
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
              const isPresent = present.has(item.id);
              return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() =>
                    setPresent((prev) => {
                      const n = new Set(prev);
                      if (n.has(item.id)) n.delete(item.id);
                      else n.add(item.id);
                      return n;
                    })
                  }
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
                  <View
                    style={{
                      marginRight: 12,
                      height: 40,
                      width: 40,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 20,
                      backgroundColor: isPresent ? '#E7F7F2' : '#FDEDEA',
                    }}
                  >
                    <Ionicons
                      name={isPresent ? 'checkmark' : 'close'}
                      size={18}
                      color={isPresent ? '#149C73' : '#E84D39'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: C.ink }}>{item.name}</Text>
                    <Text style={{ fontSize: 11, color: C.muted }}>{item.batch ?? 'No batch'}</Text>
                  </View>
                  <Text
                    style={{ fontSize: 12, fontWeight: 'bold', color: isPresent ? '#149C73' : '#E84D39' }}
                  >
                    {isPresent ? 'PRESENT' : 'ABSENT'}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={save}
            disabled={saving || students.length === 0}
            style={{
              alignItems: 'center',
              borderRadius: 999,
              paddingVertical: 14,
              backgroundColor: saving ? '#9FB3C8' : C.teal,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#fff' }}>
              {saving ? 'Saving…' : `Save Attendance (${presentVisible}/${students.length})`}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
