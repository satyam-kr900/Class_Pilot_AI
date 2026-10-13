import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { Batch, Institute, InstituteMember } from '../types/institute';

const ACTIVE_KEY = 'classpilot.activeInstituteId';

export async function getActiveInstituteId(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIVE_KEY);
}

export async function setActiveInstituteId(id: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_KEY, id);
}

/** Logged-in user ki saari memberships (institute ke saath). */
export async function getMyMemberships(): Promise<InstituteMember[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error('Login required.');
  const { data, error } = await supabase
    .from('institute_members')
    .select('id, institute_id, user_id, role, created_at, institutes(id, name, owner_id, plan, created_at)')
    .eq('user_id', userData.user.id);
  if (error) throw error;
  return (data ?? []) as unknown as InstituteMember[];
}

/** Pehla institute banao + khud owner member. */
export async function createInstitute(name: string): Promise<Institute> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error('Login required.');
  const clean = name.trim();
  if (!clean) throw new Error('Institute name required.');

  const { data: inst, error: instErr } = await supabase
    .from('institutes')
    .insert({ name: clean, owner_id: userData.user.id })
    .select()
    .single();
  if (instErr || !inst) throw instErr ?? new Error('Create failed.');

  const { error: memErr } = await supabase.from('institute_members').insert({
    institute_id: (inst as Institute).id,
    user_id: userData.user.id,
    role: 'owner',
  });
  if (memErr) throw memErr;
  await setActiveInstituteId((inst as Institute).id);
  return inst as Institute;
}

export async function getBatches(instituteId: string): Promise<Batch[]> {
  const { data, error } = await supabase
    .from('batches')
    .select('*')
    .eq('institute_id', instituteId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Batch[];
}

export async function createBatch(
  instituteId: string,
  input: { name: string; subject?: string | null; schedule?: string | null }
): Promise<Batch> {
  const clean = input.name.trim();
  if (!clean) throw new Error('Batch name required.');
  const { data, error } = await supabase
    .from('batches')
    .insert({
      institute_id: instituteId,
      name: clean,
      subject: input.subject?.trim() || null,
      schedule: input.schedule?.trim() || null,
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Create failed.');
  return data as Batch;
}
