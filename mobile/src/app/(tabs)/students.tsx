import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { getActiveInstituteId, getMyMemberships } from '../../services/institute.service';
import { useInstitute } from '../../hooks/useInstitute';
import { canManage } from '../../types/institute';
import { shareViaWhatsApp } from '../../lib/share';
import type { Student } from '../../types/institute';
import { C, GlassCard, GlassInput, PrimaryButton, RowIcon, ScreenBg } from '../../components/ui';

const FREE_LIMIT = 20;

export default function StudentsScreen() {
  const { role } = useInstitute();
  const [students, setStudents] = useState<Student[]>([]);
  const [name, setName] = useState('');
  const [batch, setBatch] = useState('');
  const [fee, setFee] = useState('');
  const [guardian, setGuardian] = useState('');
  const [phone, setPhone] = useState('');
  const [klass, setKlass] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadStudents = useCallback(async () => {
    const { data, error } = await supabase
      .from('students')
      .select('id, owner_id, institute_id, name, batch, monthly_fee, guardian_name, guardian_phone, class_name, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      if (/guardian|class_name/i.test(error.message)) {
        // 002 migration abhi nahi chali — purane columns se load karo.
        const retry = await supabase
          .from('students')
          .select('id, owner_id, institute_id, name, batch, monthly_fee, created_at')
          .order('created_at', { ascending: false });
        if (!retry.error) setStudents((retry.data ?? []) as Student[]);
        else Alert.alert('Error loading students', retry.error.message);
      } else {
        Alert.alert('Error loading students', error.message);
      }
      return;
    }
    setStudents((data ?? []) as Student[]);
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  async function addStudent() {
    if (!canManage(role)) {
      Alert.alert('No permission', 'Sirf owner/teacher/staff students add kar sakte hain.');
      return;
    }
    const cleanName = name.trim();
    const monthlyFee = Number(fee);
    if (!cleanName || !fee.trim() || !Number.isFinite(monthlyFee) || monthlyFee < 0) {
      Alert.alert('Invalid details', 'Enter a name and valid fee.');
      return;
    }
    setLoading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        Alert.alert('Login required', 'Please log in again.');
        return;
      }
      // Free plan limit: 20 students.
      try {
        const members = await getMyMemberships();
        const instituteId = await getActiveInstituteId().catch(() => null);
        const plan = members.find((m) => m.institute_id === instituteId)?.institutes?.plan ?? 'free';
        if (plan === 'free' && students.length >= FREE_LIMIT) {
          Alert.alert(
            'Free limit reached',
            `Free plan me ${FREE_LIMIT} students tak. Growth plan (₹999/mo) me unlimited.`
          );
          return;
        }
      } catch {
        // Membership tables missing — limit skip karo, insert try karo.
      }
      const instituteId = await getActiveInstituteId().catch(() => null);
      const payload: Record<string, unknown> = {
        owner_id: userData.user.id,
        name: cleanName,
        batch: batch.trim() || null,
        monthly_fee: monthlyFee,
        guardian_name: guardian.trim() || null,
        guardian_phone: phone.trim() || null,
        class_name: klass.trim() || null,
      };
      if (instituteId) payload.institute_id = instituteId;

      let { error } = await supabase.from('students').insert(payload);
      if (error && /institute_id|guardian|class_name/i.test(error.message)) {
        // Purana schema — sirf core columns bhejo.
        ({ error } = await supabase.from('students').insert({
          owner_id: userData.user.id,
          name: cleanName,
          batch: batch.trim() || null,
          monthly_fee: monthlyFee,
        }));
      }
      if (error) {
        Alert.alert('Could not add student', error.message);
        return;
      }
      setName('');
      setBatch('');
      setFee('');
      setGuardian('');
      setPhone('');
      setKlass('');
      await loadStudents();
      Alert.alert('Success', 'Student added successfully.');
    } finally {
      setLoading(false);
    }
  }

  async function deleteStudent(id: string) {
    if (!canManage(role)) {
      Alert.alert('No permission', 'Sirf owner/teacher/staff delete kar sakte hain.');
      return;
    }
    Alert.alert('Delete student?', 'Fee/attendance history bhi dikhna band ho jayegi.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('students').delete().eq('id', id);
          if (error) {
            Alert.alert('Delete failed', error.message);
            return;
          }
          await loadStudents();
        },
      },
    ]);
  }

  async function messageGuardian(item: Student) {
    try {
      await shareViaWhatsApp(
        item.guardian_phone,
        `Namaste! ${item.name} ke guardian se sampark karna hai. — ClassPilot AI`
      );
    } catch (e) {
      Alert.alert('Share failed', e instanceof Error ? e.message : 'Could not share.');
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      await loadStudents();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenBg />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 10 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: C.ink }}>Students</Text>
          <Text style={{ marginTop: 2, fontSize: 12, color: C.muted }}>
            {students.length} students • profiles + guardians
          </Text>

          <View style={{ marginTop: 10 }}>
            <GlassCard>
              <View style={{ padding: 16 }}>
                <GlassInput value={name} onChangeText={setName} placeholder="Student name *" />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <GlassInput value={klass} onChangeText={setKlass} placeholder="Class (e.g. 10th)" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <GlassInput value={batch} onChangeText={setBatch} placeholder="Batch (e.g. A)" />
                  </View>
                </View>
                <GlassInput
                  value={fee}
                  onChangeText={setFee}
                  placeholder="Monthly fee (₹) *"
                  keyboardType="decimal-pad"
                />
                <GlassInput value={guardian} onChangeText={setGuardian} placeholder="Guardian name" />
                <GlassInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Guardian phone (WhatsApp)"
                  keyboardType="phone-pad"
                />
                <PrimaryButton
                  title={loading ? 'Saving…' : '+ Add Student'}
                  onPress={addStudent}
                  disabled={loading}
                />
              </View>
            </GlassCard>
          </View>

          <FlatList
            style={{ marginTop: 12 }}
            data={students}
            keyExtractor={(item) => item.id}
            onRefresh={onRefresh}
            refreshing={refreshing}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              <Text style={{ marginTop: 16, textAlign: 'center', color: C.muted }}>
                No students found. Add your first student.
              </Text>
            }
            renderItem={({ item }) => (
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
                <RowIcon name="person" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: 'bold', color: C.ink }}>{item.name}</Text>
                  <Text style={{ fontSize: 11, color: C.muted }}>
                    {[item.class_name, item.batch].filter(Boolean).join(' • ') || 'No class'} • ₹
                    {item.monthly_fee}/mo
                  </Text>
                  {!!(item.guardian_name || item.guardian_phone) && (
                    <Text style={{ fontSize: 11, color: C.muted }}>
                      Guardian: {item.guardian_name || '—'}
                      {item.guardian_phone ? ` • ${item.guardian_phone}` : ''}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => messageGuardian(item)}
                  style={{
                    height: 36,
                    width: 36,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 18,
                    backgroundColor: '#E4F5EC',
                    marginRight: 6,
                  }}
                >
                  <Ionicons name="logo-whatsapp" size={17} color="#1FA855" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => deleteStudent(item.id)}
                  style={{
                    height: 36,
                    width: 36,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 18,
                    backgroundColor: '#FDEDEA',
                  }}
                >
                  <Ionicons name="trash-outline" size={17} color={C.coral} />
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
