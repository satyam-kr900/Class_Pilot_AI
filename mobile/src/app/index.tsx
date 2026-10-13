import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { hasSeenOnboarding } from '../lib/onboarding';

/** Session → tabs | pehli baar → onboarding | warna → login. */
export default function Index() {
  const [state, setState] = useState<'loading' | 'tabs' | 'onboarding' | 'login'>('loading');

  useEffect(() => {
    (async () => {
      const [{ data }, seen] = await Promise.all([
        supabase.auth.getSession(),
        hasSeenOnboarding(),
      ]);
      if (data.session) setState('tabs');
      else if (!seen) setState('onboarding');
      else setState('login');
    })();
  }, []);

  if (state === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading ClassPilot AI…</Text>
      </View>
    );
  }
  if (state === 'tabs') return <Redirect href={"/(tabs)" as never} />;
  if (state === 'onboarding') return <Redirect href="/onboarding" />;
  return <Redirect href="/(auth)/login" />;
}
