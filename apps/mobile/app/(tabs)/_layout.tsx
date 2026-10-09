import { colors, fontSize } from '@symbiomed/ui-tokens'
import { Tabs } from 'expo-router'
import { useSettings } from '../../src/settings'

export default function TabsLayout() {
  const { t } = useSettings()
  const tab = (key: Parameters<typeof t>[0]) => ({ title: t(key), tabBarLabel: t(key), tabBarAccessibilityLabel: t(key), tabBarIcon: () => null })
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.textMuted, tabBarLabelStyle: { fontSize: fontSize.small }, tabBarStyle: { minHeight: 56 } }}>
      <Tabs.Screen name="index" options={tab('nav.today')} />
      <Tabs.Screen name="progress" options={tab('nav.progress')} />
      <Tabs.Screen name="brace" options={tab('nav.brace')} />
      <Tabs.Screen name="emergency" options={tab('nav.emergency')} />
      <Tabs.Screen name="settings" options={tab('nav.settings')} />
    </Tabs>
  )
}
