import { useRef, useState } from 'react';
import { Dimensions, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { markOnboardingSeen } from '../lib/onboarding';
import { C, ScreenBg } from '../components/ui';

const W = Dimensions.get('window').width;

const SLIDES: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }[] = [
  {
    icon: 'people',
    title: 'Students sambhalo',
    sub: 'Profiles, batches aur guardians — sab ek jagah.',
  },
  {
    icon: 'wallet',
    title: 'Fees track karo',
    sub: 'Dues, collection aur receipts — roz ka hisaab clear.',
  },
  {
    icon: 'checkmark-done',
    title: 'Attendance ek tap me',
    sub: 'Daily records aur monthly reports, bina register ke.',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList>(null);
  const last = page === SLIDES.length - 1;

  async function finish() {
    await markOnboardingSeen();
    router.replace('/(auth)/login');
  }

  function next() {
    if (last) {
      finish();
      return;
    }
    listRef.current?.scrollToIndex({ index: page + 1, animated: true });
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenBg />
      <SafeAreaView style={{ flex: 1 }}>
        <TouchableOpacity onPress={finish} style={{ alignSelf: 'flex-end', paddingHorizontal: 24, paddingTop: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: 'bold', color: C.muted }}>Skip</Text>
        </TouchableOpacity>

        <FlatList
          ref={listRef}
          data={SLIDES}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(s) => s.title}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / W);
            setPage(i);
          }}
          renderItem={({ item }) => (
            <View style={{ width: W, alignItems: 'center', paddingHorizontal: 32, paddingTop: 60 }}>
              <View
                style={{
                  height: 140,
                  width: 140,
                  borderRadius: 70,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(236,72,153,0.15)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.6)',
                }}
              >
                <Ionicons name={item.icon} size={64} color={C.teal} />
              </View>
              <Text style={{ marginTop: 32, fontSize: 26, fontWeight: 'bold', color: C.ink, textAlign: 'center' }}>
                {item.title}
              </Text>
              <Text style={{ marginTop: 10, fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 22 }}>
                {item.sub}
              </Text>
            </View>
          )}
        />

        <View style={{ paddingHorizontal: 32, paddingBottom: 40 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
            {SLIDES.map((s, i) => (
              <View
                key={s.title}
                style={{
                  height: 8,
                  width: i === page ? 24 : 8,
                  borderRadius: 4,
                  backgroundColor: i === page ? C.teal : 'rgba(190,160,180,0.5)',
                }}
              />
            ))}
          </View>
          <TouchableOpacity
            onPress={next}
            activeOpacity={0.85}
            style={{ borderRadius: 999, alignItems: 'center', paddingVertical: 15, backgroundColor: C.teal }}
          >
            <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#fff' }}>
              {last ? 'Get Started' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
