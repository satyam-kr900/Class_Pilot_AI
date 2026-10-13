import { useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { resendConfirmation, signIn, signInAnonymously, signUp, verifyLoginWithBackend, verifySignupWithBackend } from '../../lib/auth';
import { C, GlassCard, GlassInput, PrimaryButton, ScreenBg } from '../../components/ui';

// Dummy demo account — testing ke liye. Pehli baar auto-signup hoga.
export const DEMO_EMAIL = 'demo@classpilot.ai';
export const DEMO_PASSWORD = 'Demo1234!';

// Prod build me demo/guest band karna ho to EXPO_PUBLIC_ALLOW_DEMO=0 set karke rebuild karo.
const ALLOW_DEMO = process.env.EXPO_PUBLIC_ALLOW_DEMO !== '0';

function friendlyAuthError(message: string): string {
  if (/email rate limit exceeded/i.test(message)) {
    return 'Email limit full ho gayi hai (hourly limit). 30–60 min ruko, phir SAME email se try karo. Ya Supabase Dashboard → Authentication → Providers → Email me Confirm email OFF karo.';
  }
  if (/signups not allowed|signup.*disabled/i.test(message)) {
    return "Naye signup band hain. Supabase me 'Allow new users to sign up' ON karo.";
  }
  if (/password.*short|password.*weak/i.test(message)) {
    return 'Password kam se kam 6 characters ka rakho.';
  }
  if (/email not confirmed|not confirmed/i.test(message)) {
    return 'Email confirm nahi hui. Inbox ka link kholo, phir SAME email se login karo.';
  }
  return message;
}

function backendDownMessage(e: unknown): string {
  const detail = e instanceof Error ? e.message : 'Backend verification failed.';
  if (/failed to fetch|network|ECONNREFUSED|Network request failed/i.test(detail)) {
    return 'Account ban gaya! Par backend :8000 se baat nahi ho rahi — backend start karo (aur phone par LAN IP use karo), phir Login dabao.';
  }
  return `Account ban gaya! Backend verify pending: ${detail} — phir bhi Login try karo.`;
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState(ALLOW_DEMO ? DEMO_EMAIL : '');
  const [password, setPassword] = useState(ALLOW_DEMO ? DEMO_PASSWORD : '');
  const [loading, setLoading] = useState(false);

  function goTabs() {
    router.replace('/(tabs)' as never);
  }

  function goTabsWithBackendNote() {
    Alert.alert('Login OK', 'Backend verify pending hai (backend me service key dalni baaki). Supabase session se andar ja rahe ho.', [
      { text: 'Continue', onPress: goTabs },
    ]);
  }

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        Alert.alert('Login failed', friendlyAuthError(error.message));
        return;
      }
      // Backend verify — 401 ho to BLOCK, down/500 ho to warning + aage jao
      try {
        const status = await verifyLoginWithBackend();
        if (status === 'skipped') {
          goTabsWithBackendNote();
          return;
        }
      } catch (e) {
        Alert.alert('Verification failed', e instanceof Error ? e.message : 'Backend verification failed.');
        return;
      }
      goTabs();
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup() {
    if (!email.trim() || password.length < 8) {
      Alert.alert('Check details', 'Enter an email and a password of at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await signUp(email, password);
      if (error) {
        Alert.alert('Signup failed', friendlyAuthError(error.message));
        return;
      }
      if (data.session) {
        // Session mila → backend verify + institute, phir SAME email se login state me hi andar
        try {
          const status = await verifySignupWithBackend();
          if (status === null) {
            Alert.alert('Verify email', 'Signup ho gaya! Email confirm karo, phir SAME email se login karo.');
            return;
          }
          if (status === 'skipped') {
            goTabsWithBackendNote();
            return;
          }
        } catch (e) {
          Alert.alert('Account ban gaya', backendDownMessage(e));
          return;
        }
        goTabs();
      } else {
        Alert.alert('Verify email', 'Signup ho gaya! Email confirm karo, phir SAME email se login karo.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDemo() {
    setLoading(true);
    try {
      setEmail(DEMO_EMAIL);
      setPassword(DEMO_PASSWORD);
      let { error } = await signIn(DEMO_EMAIL, DEMO_PASSWORD);
      if (error && /invalid login credentials/i.test(error.message)) {
        const { data: signUpData, error: signUpErr } = await signUp(DEMO_EMAIL, DEMO_PASSWORD);
        if (signUpErr && !/already registered|already exists/i.test(signUpErr.message)) {
          Alert.alert('Demo signup failed', friendlyAuthError(signUpErr.message));
          return;
        }
        if (signUpData.session) {
          // Server-fault ho to 'skipped' aata hai (throw nahi) → aage badho
          try {
            await verifySignupWithBackend();
          } catch (e) {
            Alert.alert('Verification failed', e instanceof Error ? e.message : 'Backend verification failed.');
            return;
          }
        }
        ({ error } = await signIn(DEMO_EMAIL, DEMO_PASSWORD));
      }
      if (error) {
        Alert.alert('Demo login failed', friendlyAuthError(error.message));
        return;
      }
      try {
        const status = await verifyLoginWithBackend();
        if (status === 'skipped') {
          goTabsWithBackendNote();
          return;
        }
      } catch (e) {
        Alert.alert('Verification failed', e instanceof Error ? e.message : 'Backend verification failed.');
        return;
      }
      goTabs();
    } finally {
      setLoading(false);
    }
  }

  async function handleGuest() {
    setLoading(true);
    try {
      const { data, error } = await signInAnonymously();
      console.log('Guest login result:', JSON.stringify({ user: !!data?.user, error }));
      if (error) {
        const detail = `__Host: ${(error as { status?: number }).status ?? '?'} / ${(error as { code?: string }).code ?? 'no-code'}\n${error.message}`;
        if (/anonymous sign-ins are disabled/i.test(error.message)) {
          Alert.alert(
            'Abhi bhi OFF hai',
            'Toggle save nahi hua lagta hai. Dashboard → Authentication → Providers → "Allow anonymous sign-ins" ON + Save dabao, sahi project me (crsooyscgcevnrisdiyg). Phir dobara try karo.\n\n' + detail
          );
        } else if (/rate|limit|429/i.test(detail)) {
          Alert.alert(
            'Rate limit',
            'Bahut baar tap ho gaya (30/hour limit). 10 min ruko ya doosre network se try karo.\n\n' + detail
          );
        } else if (/captcha/i.test(detail)) {
          Alert.alert(
            'Captcha ON hai',
            'Dashboard → Authentication → Protection me Bot/Captcha protection OFF karo testing ke liye.\n\n' + detail
          );
        } else {
          Alert.alert('Guest login failed', detail);
        }
        return;
      }
      router.replace('/(tabs)' as never);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenBg />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          <GlassCard>
            <View style={{ padding: 22 }}>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: C.teal }}>ClassPilot AI</Text>
              <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#3F1D33', marginTop: 4 }}>
                Institute login
              </Text>
              <Text style={{ fontSize: 13, color: C.muted, marginTop: 4, marginBottom: 10 }}>
                Students, fees, attendance — Supabase secured.
              </Text>
              {ALLOW_DEMO && (
                <View
                  style={{
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: '#149C73',
                    borderStyle: 'dashed',
                    backgroundColor: 'rgba(20,156,115,0.1)',
                    padding: 10,
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#0E7A55' }}>
                    ⚡ Dummy demo account
                  </Text>
                  <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {DEMO_EMAIL} • {DEMO_PASSWORD}
                  </Text>
                </View>
              )}
              <GlassInput
                placeholder="Email address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
              />
              <GlassInput
                placeholder="Password (minimum 8 characters)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <PrimaryButton title={loading ? 'Please wait…' : 'Login'} onPress={handleLogin} disabled={loading} />
              {ALLOW_DEMO && (
                <TouchableOpacity
                  onPress={handleDemo}
                  disabled={loading}
                  style={{
                    marginTop: 10,
                    borderRadius: 999,
                    alignItems: 'center',
                    paddingVertical: 13,
                    backgroundColor: loading ? '#9FB3C8' : '#0a1633',
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#fff' }}>
                    ⚡ 1-Tap Demo Login
                  </Text>
                </TouchableOpacity>
              )}
              {ALLOW_DEMO && (
                <TouchableOpacity
                  onPress={handleGuest}
                disabled={loading}
                style={{
                  marginTop: 10,
                  borderRadius: 999,
                  alignItems: 'center',
                  paddingVertical: 13,
                  backgroundColor: loading ? '#9FB3C8' : '#DB2777',
                }}
              >
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#fff' }}>
                    🚀 1-Tap Guest Login (no password)
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleSignup}
                disabled={loading}
                style={{
                  marginTop: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.6)',
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  alignItems: 'center',
                  paddingVertical: 13,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#3F1D33' }}>
                  New institute? Create account
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (!email.trim()) {
                    Alert.alert('Email likho', 'Pehle email likho, phir resend dabao.');
                    return;
                  }
                  const { error } = await resendConfirmation(email);
                  Alert.alert(
                    error ? 'Resend failed' : 'Email bhej di',
                    error ? friendlyAuthError(error.message) : 'Inbox (aur spam) check karo, link kholo, phir SAME email se login karo.'
                  );
                }}
                disabled={loading}
                style={{ marginTop: 10, alignItems: 'center', paddingVertical: 6 }}
              >
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: C.muted, textDecorationLine: 'underline' }}>
                  Email confirm nahi hui? Confirmation dobara bhejo
                </Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
