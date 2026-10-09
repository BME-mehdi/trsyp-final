import Ionicons from '@expo/vector-icons/Ionicons'
import { colors, fontFamily, fontSize, iconSize } from '@symbiomed/ui-tokens'
import { Tabs } from 'expo-router'
import type { ComponentProps } from 'react'
import type { ColorValue } from 'react-native'
import { useSettings } from '../../src/settings'

type Icon = ComponentProps<typeof Ionicons>['name']

export default function TabsLayout() {
  const { t } = useSettings()
  // Icons always sit next to their text label; they are hidden from screen readers (the label is read).
  const tab = (key: Parameters<typeof t>[0], icon: Icon, iconActive: Icon) => ({
    title: t(key), tabBarLabel: t(key), tabBarAccessibilityLabel: t(key),
    tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => <Ionicons name={focused ? iconActive : icon} size={iconSize.md} color={color as string} accessibilityElementsHidden importantForAccessibility="no" />,
  })
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.textMuted, tabBarLabelStyle: { fontSize: fontSize.small, fontFamily: fontFamily.regular }, tabBarStyle: { minHeight: 64, paddingTop: 4 }, headerTitleStyle: { fontFamily: fontFamily.bold } }}>
      <Tabs.Screen name="index" options={tab('nav.today', 'sunny-outline', 'sunny')} />
      <Tabs.Screen name="progress" options={tab('nav.progress', 'trending-up-outline', 'trending-up')} />
      <Tabs.Screen name="brace" options={tab('nav.brace', 'bluetooth-outline', 'bluetooth')} />
      <Tabs.Screen name="emergency" options={tab('nav.emergency', 'alert-circle-outline', 'alert-circle')} />
      <Tabs.Screen name="settings" options={tab('nav.settings', 'settings-outline', 'settings')} />
    </Tabs>
  )
}
