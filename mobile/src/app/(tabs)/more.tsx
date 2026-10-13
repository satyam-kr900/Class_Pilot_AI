import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { C, GlassCard, ScreenBg } from '../../components/ui';

const ITEMS: [string, string, string][] = [
  ['Batches', 'Classes, subjects aur student assignment', '/batches'],
  ['Messages', 'Notices, fee reminders — WhatsApp share', '/communication'],
  ['Expenses', 'Kharcha aur monthly summary', '/expenses'],
  ['Enquiries', 'Admission leads, student me convert', '/enquiries'],
  ['AI Insights', 'Collection, defaulters, low attendance', '/insights'],
  ['Settings', 'Institute, plan, logout', '/settings'],
];

export default function MoreScreen() {
  const router = useRouter();
  return (
    <View style={{ flex: 1 }}>
      <ScreenBg />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} contentContainerStyle={{ paddingBottom: 30 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: C.ink }}>More</Text>
          <Text style={{ marginTop: 2, fontSize: 12, color: C.muted }}>
            Business modules — sab kuch ek jagah
          </Text>
          <View style={{ marginTop: 12 }}>
            <GlassCard>
              <View style={{ padding: 8 }}>
                {ITEMS.map(([label, sub, href]) => (
                  <TouchableOpacity
                    key={label}
                    onPress={() => router.push(href as never)}
                    style={{
                      paddingVertical: 13,
                      paddingHorizontal: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: 'rgba(255,255,255,0.5)',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ flex: 1, fontSize: 15, fontWeight: 'bold', color: C.ink }}>{label}</Text>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: C.teal }}>→</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</Text>
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
