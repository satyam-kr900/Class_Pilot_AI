import { supabase } from './supabase';
import { isServerFault, registerWithBackend, verifyWithBackend } from './api';

/**
 * Supabase Auth helpers. Passwords Supabase Auth me hashed store hote hain —
 * kabhi khud table me password mat rakho.
 */
export async function signUp(email: string, password: string) {
  return await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
  });
}

export async function signIn(email: string, password: string) {
  return await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
}

/** Confirmation email dobara bhejo (unconfirmed user ke liye). */
export async function resendConfirmation(email: string) {
  return await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
  });
}

export async function signOut() {
  return await supabase.auth.signOut();
}

/**
 * Guest login — Dashboard → Authentication → Providers → Anonymous ON
 * karne ke baad hi chalega, warna "Anonymous sign-ins are disabled".
 */
export async function signInAnonymously() {
  return await supabase.auth.signInAnonymously();
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

/** Session ka access_token nikalo — backend verify/register ke liye. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Signup ke baad: backend verify + default institute.
 * - 'verified' → backend OK
 * - 'skipped' → backend down/500, par Supabase account ban gaya (user ki galti nahi)
 * - null → session hi nahi (email-confirm ON): user ko email confirm karke SAME email se login karna hoga.
 */
export async function verifySignupWithBackend(): Promise<'verified' | 'skipped' | null> {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    await registerWithBackend(token);
    return 'verified';
  } catch (e) {
    if (isServerFault(e)) return 'skipped';
    throw e;
  }
}

/**
 * Login ke baad: backend verify.
 * - 'verified' → token sahi
 * - 'skipped' → backend down/500 → Supabase session se aage jao (warning ke saath)
 * - 401/400 → token kharab → signOut + throw (BLOCK)
 */
export async function verifyLoginWithBackend(): Promise<'verified' | 'skipped'> {
  const token = await getAccessToken();
  if (!token) throw new Error('Session nahi mila. Email confirm kiya hai?');
  try {
    await verifyWithBackend(token);
    return 'verified';
  } catch (e) {
    if (isServerFault(e)) return 'skipped';
    await supabase.auth.signOut();
    throw e;
  }
}
