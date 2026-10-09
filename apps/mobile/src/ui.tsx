import { colors, elevation, fontFamily, fontSize, page, radius, radiusLg, space, status, touchTarget, type StatusTone } from '@symbiomed/ui-tokens'
import type { ReactNode } from 'react'
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, type TextProps } from 'react-native'
import { usePressScale } from './anim'
import { useSettings } from './settings'

// Text follows the system font size (no maxFontSizeMultiplier, no fixed lineHeight, so 200 % does not clip)
// and the app's own text-size setting on top.
type Size = keyof typeof fontSize
export function Txt({ size = 'body', bold, muted, style, ...p }: TextProps & { size?: Size; bold?: boolean; muted?: boolean }) {
  const { textScale } = useSettings()
  return <Text {...p} style={[{ fontSize: fontSize[size] * textScale, color: muted ? colors.textMuted : colors.text, fontFamily: bold ? fontFamily.bold : fontFamily.regular }, style]} />
}

export function Button({ label, onPress, disabled, variant = 'primary', hint, testID, icon }: { label: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'secondary'; hint?: string; testID?: string; icon?: ReactNode }) {
  const primary = variant === 'primary'
  const press = usePressScale()
  return (
    <Animated.View style={press.style}>
    <Pressable onPressIn={press.onPressIn} onPressOut={press.onPressOut} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ disabled: !!disabled }} testID={testID}
      style={({ pressed }) => [styles.button, primary ? styles.primary : styles.secondary, disabled && styles.disabled, pressed && { opacity: 0.85 }]}>
      {icon}
      <Txt bold size={primary ? 'large' : 'body'} style={{ color: disabled ? status.neutral.fg : primary ? colors.onAccent : colors.text, textAlign: 'center', flexShrink: 1 }}>{label}</Txt>
    </Pressable>
    </Animated.View>
  )
}

/** Status is always written out: colour never carries it alone. */
export const Chip = ({ tone, label }: { tone: StatusTone; label: string }) => (
  <View style={[styles.chip, { backgroundColor: status[tone].bg }]}>
    <Txt size="small" bold style={{ color: status[tone].fg }}>{label}</Txt>
  </View>
)

export const Card = ({ children, tint }: { children: ReactNode; tint?: string }) => <View style={[styles.card, tint ? { backgroundColor: tint } : null]}>{children}</View>

export function Screen({ title, children, subtitle }: { title: string; children: ReactNode; subtitle?: string }) {
  return (
    <ScrollView style={{ backgroundColor: page.patient }} contentContainerStyle={styles.screen}>
      <View style={{ gap: space.xs }}>
        <Txt size="title" bold accessibilityRole="header">{title}</Txt>
        {subtitle ? <Txt muted>{subtitle}</Txt> : null}
      </View>
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
  screen: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  button: { minHeight: Math.max(touchTarget, 56), borderRadius: radiusLg.lg, paddingHorizontal: space.lg, paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  primary: { backgroundColor: colors.accent, ...elevation.low.rn },
  secondary: { backgroundColor: colors.background, borderWidth: 2, borderColor: colors.control },
  disabled: { backgroundColor: status.neutral.bg, borderColor: status.neutral.bg },
  chip: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
  card: { backgroundColor: colors.background, borderRadius: radiusLg.lg, padding: space.lg, gap: space.sm, ...elevation.low.rn },
  banner: { backgroundColor: colors.surface, borderBottomWidth: 2, borderColor: colors.text, padding: space.sm },
})
