import { motion } from '@symbiomed/ui-tokens'
import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/**
 * The one place motion and haptics come from. With the system reduce-motion setting on, every
 * duration is 0 (the static equivalent) and celebrations are off. Uses React Native's Animated API
 * and expo-haptics, both available in Expo Go.
 */
export function useMotion() {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    let live = true
    AccessibilityInfo.isReduceMotionEnabled().then((v) => live && setReduce(v)).catch(() => undefined)
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce)
    return () => { live = false; sub.remove() }
  }, [])
  return {
    reduce,
    duration: (d: keyof typeof motion.duration) => (reduce ? 0 : motion.duration[d]),
    /** A light tick. Haptics never carry information on their own. */
    tick: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined) },
  }
}
