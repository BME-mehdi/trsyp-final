import Ionicons from '@expo/vector-icons/Ionicons'
import { colors, motion, space, warm } from '@symbiomed/ui-tokens'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { Pop } from './anim'
import { useMotion } from './motion'
import { Txt } from './ui'

// Progress visuals. Each one is decorative: the number or state is always written next to it as text,
// and the graphic is hidden from screen readers.
/** Tweens a number to `target` over `ms` (ease-out cubic), frame by frame. With ms = 0 it jumps. Works on native and web. */
export function useTween(target: number, ms: number, delay: number) {
  const [v, setV] = useState(ms === 0 ? target : 0)
  useEffect(() => {
    if (ms === 0) { setV(target); return }
    let raf = 0
    const from = 0, t0 = Date.now() + delay
    const step = () => {
      const p = Math.min(1, Math.max(0, (Date.now() - t0) / ms))
      setV(from + (target - from) * (1 - (1 - p) ** 3))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms, delay])
  return v
}

/** A ring that fills from 0 to `value` (0..1). With reduce motion on, it is drawn filled at once. */
export function Ring({ value, size = 72, label, state, delay = 0 }: { value: number; size?: number; label: string; state: string; delay?: number }) {
  const { reduce } = useMotion()
  const stroke = 8, r = (size - stroke) / 2, c = 2 * Math.PI * r
  const fill = useTween(value, reduce ? 0 : motion.duration.slow, delay)
  const offset = c * (1 - fill)
  return (
    <View accessible accessibilityLabel={`${label}: ${state}`} style={{ alignItems: 'center', gap: space.xs, flex: 1, minWidth: size }}>
      <View style={{ width: size, height: size }}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={warm.track} strokeWidth={stroke} fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={warm.fill} strokeWidth={stroke} fill="none" strokeLinecap="round"
            strokeDasharray={`${c} ${c}`} strokeDashoffset={offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </Svg>
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Pop show={value >= 1} delay={delay + motion.duration.slow}>
            <Ionicons name="checkmark" size={Math.round(size * 0.42)} color={warm.fill} accessibilityElementsHidden importantForAccessibility="no" />
          </Pop>
        </View>
      </View>
      <Txt bold style={{ textAlign: 'center' }}>{label}</Txt>
      <Txt size="small" muted style={{ textAlign: 'center' }}>{state}</Txt>
    </View>
  )
}

/** A horizontal bar, value 0..1, with its text label above. */
export function Bar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <View style={{ gap: space.xs }}>
      <Txt>{label}</Txt>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 12, borderRadius: 6, backgroundColor: warm.track, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: warm.fill, borderRadius: 6 }} />
      </View>
    </View>
  )
}

/** Half-circle gauge of a value against a goal (the goal tick is drawn; numbers are written by the caller). */
export function ArcGauge({ value, goal, max }: { value: number; goal: number; max: number }) {
  const w = 220, h = 120, r = 96, cx = w / 2, cy = 110
  const pt = (f: number) => { const a = Math.PI * (1 - Math.max(0, Math.min(1, f))); return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const }
  const arc = (f: number) => { const [x, y] = pt(f); return `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${x} ${y}` }
  const [gx, gy] = pt(goal / max)
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
      <Path d={arc(1)} stroke={warm.track} strokeWidth={14} fill="none" strokeLinecap="round" />
      <Path d={arc(value / max)} stroke={warm.fill} strokeWidth={14} fill="none" strokeLinecap="round" />
      <Circle cx={gx} cy={gy} r={6} fill={colors.background} stroke={colors.text} strokeWidth={3} />
    </Svg>
    </View>
  )
}

/** A large ring with content in its centre (the hero's "1 of 2"). Fill and track colours come from the caller. */
export function BigRing({ value, size = 128, fill, track, children }: { value: number; size?: number; fill: string; track: string; children: React.ReactNode }) {
  const { reduce } = useMotion()
  const stroke = 12, r = (size - stroke) / 2, c = 2 * Math.PI * r
  const v = useTween(value, reduce ? 0 : motion.duration.slow, 150)
  return (
    <View style={{ width: size, height: size }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={fill} strokeWidth={stroke} fill="none" strokeLinecap="round"
            strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - v)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </Svg>
      </View>
      <View style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </View>
  )
}
