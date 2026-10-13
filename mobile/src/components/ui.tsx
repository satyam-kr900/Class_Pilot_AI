import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

/** ClassPilot ka single glass style — saari screens isi kit se banti hain. */

export const C = {
  ink: '#581C3F',
  muted: '#A37E93',
  teal: '#EC4899',
  pink: '#EC4899',
  green: '#149C73',
  coral: '#E84D39',
  inputBg: 'rgba(255,255,255,0.22)',
  inputBorder: 'rgba(255,255,255,0.5)',
};

export function ScreenBg() {
  return (
    <>
      <LinearGradient
        colors={['#FDF2F8', '#FCE7F3', '#F3E8FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(236,72,153,0.07)' },
        ]}
      />
    </>
  );
}

export function GlassCard({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.55)',
        overflow: 'hidden',
      }}
    >
      <BlurView intensity={40} tint="light" style={{ borderRadius: 24 }}>
        <LinearGradient
          colors={['rgba(255,255,255,0.32)', 'rgba(252,231,243,0.22)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {children}
        </LinearGradient>
      </BlurView>
    </View>
  );
}

export function GlassInput({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  editable,
  maxLength,
  returnKeyType,
  onSubmitEditing,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad' | 'email-address' | 'phone-pad';
  secureTextEntry?: boolean;
  editable?: boolean;
  maxLength?: number;
  returnKeyType?: 'done' | 'next' | 'search' | 'send' | 'go';
  onSubmitEditing?: () => void;
}) {
  return (
    <View
      style={{
        borderRadius: 16,
        backgroundColor: C.inputBg,
        borderWidth: 1,
        borderColor: C.inputBorder,
        overflow: 'hidden',
        marginTop: 8,
        opacity: editable === false ? 0.6 : 1,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(20,33,43,0.4)"
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        editable={editable}
        maxLength={maxLength}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        style={{ paddingHorizontal: 14, height: 50, fontSize: 14, color: '#3F1D33' }}
      />
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
      style={{
        marginTop: 12,
        borderRadius: 999,
        overflow: 'hidden',
        backgroundColor: disabled ? '#9FB3C8' : C.teal,
        alignItems: 'center',
        paddingVertical: 13,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#fff' }}>{title}</Text>
    </TouchableOpacity>
  );
}

export function RowIcon({ name, bg }: { name: keyof typeof Ionicons.glyphMap; bg?: string }) {
  return (
    <View
      style={{
        marginRight: 12,
        height: 40,
        width: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        backgroundColor: bg ?? 'rgba(255,255,255,0.5)',
      }}
    >
      <Ionicons name={name} size={18} color={C.ink} />
    </View>
  );
}
