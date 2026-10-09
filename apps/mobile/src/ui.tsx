import { colors, fontSize, radius, space, status, touchTarget, type StatusTone } from '@symbiomed/ui-tokens'
import type { ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, type TextProps } from 'react-native'
import { useSettings } from './settings'

// Text follows the system font size (no maxFontSizeMultiplier, no fixed lineHeight, so 200 % does not clip)
// and the app's own text-size setting on top.
type Size = keyof typeof fontSize
export function Txt({ size = 'body', bold, muted, style, ...p }: TextProps & { size?: Size; bold?: boolean; muted?: boolean }) {
  const { textScale } = useSettings()
  return <Text {...p} style={[{ fontSize: fontSize[size] * textScale, color: muted ? colors.textMuted : colors.text, fontWeight: bold ? '600' : '400' }, style]} />
}

export function Button({ label, onPress, disabled, variant = 'primary', hint, testID }: { label: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'secondary'; hint?: string; testID?: string }) {
  const primary = variant === 'primary'
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ disabled: !!disabled }} testID={testID}
      style={({ pressed }) => [styles.button, primary ? styles.primary : styles.secondary, disabled && styles.disabled, pressed && { opacity: 0.8 }]}>
      <Txt bold style={{ color: disabled ? status.neutral.fg : primary ? colors.onAccent : colors.text, textAlign: 'center' }}>{label}</Txt>
    </Pressable>
  )
}

/** Status is always written out: colour never carries it alone. */
export const Chip = ({ tone, label }: { tone: StatusTone; label: string }) => (
  <View style={[styles.chip, { backgroundColor: status[tone].bg }]}>
    <Txt size="small" bold style={{ color: status[tone].fg }}>{label}</Txt>
  </View>
)

export const Card = ({ children }: { children: ReactNode }) => <View style={styles.card}>{children}</View>

export function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Txt size="title" bold accessibilityRole="header">{title}</Txt>
      {children}
    </ScrollView>
  )
}

export function Banner() {
  const { t } = useSettings()
  return (
    <View style={styles.banner} accessibilityRole="text">
      <Txt size="small" bold style={{ textAlign: 'center' }}>{t('banner.prototype')}</Txt>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { padding: space.lg, gap: space.lg },
  button: { minHeight: Math.max(touchTarget, 48), borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.sm, justifyContent: 'center' },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.background, borderWidth: 2, borderColor: colors.control },
  disabled: { backgroundColor: status.neutral.bg, borderColor: status.neutral.bg },
  chip: { alignSelf: 'flex-start', borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.xs },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, gap: space.sm },
  banner: { backgroundColor: colors.surface, borderBottomWidth: 2, borderColor: colors.text, padding: space.sm },
})
