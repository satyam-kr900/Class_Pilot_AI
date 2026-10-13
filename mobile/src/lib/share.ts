import { Alert, Linking, Share } from 'react-native';

/** Indian numbers: 10 digit → 91 prefix. */
export function formatWaPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length === 10) return '91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits.length >= 10 ? digits : null;
}

export async function shareViaWhatsApp(phone: string | null | undefined, message: string) {
  const cleanMsg = message?.trim();
  if (!cleanMsg) throw new Error('Message khaali hai.');
  const to = formatWaPhone(phone);
  const text = encodeURIComponent(cleanMsg);
  if (to) {
    const url = `https://wa.me/${to}?text=${text}`;
    const can = await Linking.canOpenURL(url);
    if (can) {
      await Linking.openURL(url);
      return;
    }
  }
  // Number nahi hai to system share sheet (user khud WhatsApp choose kare).
  await Share.share({ message });
}

export function feeReminderMsg(student: string, amount: number, institute: string) {
  return (
    `Namaste! ${institute} se suchna:\n` +
    `${student} ki is mahine ki fee ₹${amount} pending hai.\n` +
    `Kripya jald jama karein. Dhanyavaad!`
  );
}

export function receiptMsg(receiptNo: string, student: string, amount: number, date: string, institute: string) {
  return (
    `${institute} — Fee Receipt\n` +
    `Receipt: ${receiptNo}\nStudent: ${student}\nAmount: ₹${amount}\nDate: ${date}\nDhanyavaad!`
  );
}

export function attendanceMsg(student: string, status: string, date: string, institute: string) {
  const line = status === 'present' ? 'uplabdh tha/aaj class me tha' : 'anupasthit tha';
  return `${institute} se suchna: ${student} ${date} ko ${line}.`;
}

export function markPresentFallback(e: unknown) {
  Alert.alert('Share failed', e instanceof Error ? e.message : 'Could not share.');
}
