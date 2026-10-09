import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold, useFonts } from '@expo-google-fonts/atkinson-hyperlegible'
import { useState } from 'react'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '@symbiomed/ui-tokens'
import { ApiProvider } from '../src/api'
import { AuthProvider, useAuth } from '../src/auth'
import { BraceProvider } from '../src/brace/status'
import { PrivacyOverlay } from '../src/privacy'
import { SignInScreen } from '../src/screens/SignIn'
import { SettingsProvider, useSettings } from '../src/settings'
import { Banner } from '../src/ui'

function Gate() {
  const { status } = useAuth()
  const { t } = useSettings()
  if (status !== 'signed-in') return <SignInScreen />
  return (
    <Stack screenOptions={{ headerBackTitle: t('common.back') }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="checklist" options={{ title: t('checklist.title') }} />
      <Stack.Screen name="after-session" options={{ title: t('feedback.title') }} />
    </Stack>
  )
}

function Session({ queryClient }: { queryClient: QueryClient }) {
  const { biometric, reset } = useSettings()
  // Sign-out: stored keys wiped by AuthProvider; cached patient data and settings cleared here.
  const onSignedOut = () => {
    queryClient.clear()
    reset()
  }
  return (
    <AuthProvider biometric={biometric} onSignedOut={onSignedOut}>
      <ApiProvider>
        <BraceProvider>
          <Gate />
        </BraceProvider>
      </ApiProvider>
    </AuthProvider>
  )
}

export default function RootLayout() {
  // Atkinson Hyperlegible; on a load error the system font is used (the app still renders).
  const [fontsLoaded, fontError] = useFonts({ AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold })
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, gcTime: 5 * 60_000 } } }))
  if (!fontsLoaded && !fontError) return null
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
            <StatusBar style="dark" />
            <Banner />
            <Session queryClient={queryClient} />
            <PrivacyOverlay />
          </SafeAreaView>
        </SettingsProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
