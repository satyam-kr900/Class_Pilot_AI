import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { supabase } from '../../lib/supabase';

/** Login ho to seedha tabs par (dobara login mat dikhao). */
export default function AuthLayout() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (authed === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading…</Text>
      </View>
    );
  }
  if (authed) return <Redirect href={"/(tabs)" as never} />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}
