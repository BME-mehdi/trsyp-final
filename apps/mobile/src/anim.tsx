import { motion } from '@symbiomed/ui-tokens'
import { useEffect, useRef, type ReactNode } from 'react'
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native'
import { useMotion } from './motion'

// Small motion building blocks (all under 400 ms, all static with reduce motion on).

/** Fades and lifts its children in, `index` staggers siblings by 60 ms (capped). */
export function FadeIn({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  const { reduce } = useMotion()
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current
  useEffect(() => {
    if (reduce) { v.setValue(1); return }
    Animated.timing(v, { toValue: 1, duration: motion.duration.base, delay: Math.min(index, 5) * 60, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
  }, [reduce, index, v])
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>{children}</Animated.View>
}

/** Pops in with a gentle spring (scale 0.6 -> 1). Used for a completed ring's check and the completion moment. */
export function Pop({ children, show = true, delay = 0 }: { children: ReactNode; show?: boolean; delay?: number }) {
  const { reduce } = useMotion()
  const v = useRef(new Animated.Value(show && reduce ? 1 : 0)).current
  useEffect(() => {
    if (!show) { v.setValue(0); return }
    if (reduce) { v.setValue(1); return }
    Animated.sequence([Animated.delay(delay), Animated.spring(v, { toValue: 1, damping: 12, stiffness: 220, mass: 0.6, useNativeDriver: true })]).start()
  }, [show, reduce, delay, v])
  if (!show) return null
  return <Animated.View style={{ opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>{children}</Animated.View>
}

/** Press feedback: scales to 0.97 while pressed. Returns handlers and the animated style. */
export function usePressScale() {
  const { reduce } = useMotion()
  const s = useRef(new Animated.Value(1)).current
  const to = (toValue: number) => { if (!reduce) Animated.spring(s, { toValue, damping: 18, stiffness: 400, mass: 0.5, useNativeDriver: true }).start() }
  return { onPressIn: () => to(0.97), onPressOut: () => to(1), style: { transform: [{ scale: s }] } }
}
