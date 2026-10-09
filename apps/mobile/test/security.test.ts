import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> }
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? sources(join(dir, f)) : /\.tsx?$/.test(f) ? [join(dir, f)] : []))

describe('mobile security rules', () => {
  it('ships no analytics, crash-reporting or notification SDK', () => {
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
    expect(deps.filter((d) => /analytics|firebase|segment|amplitude|mixpanel|sentry|bugsnag|crashlytics|datadog|appcenter|expo-notifications|onesignal|insights/i.test(d))).toEqual([])
  })

  it('has no WebView: sign-in uses the system browser', () => {
    expect(Object.keys(pkg.dependencies).filter((d) => /webview/i.test(d))).toEqual([])
  })

  it('keeps data only in expo-secure-store, through src/storage.ts', () => {
    expect(Object.keys(pkg.dependencies)).not.toContain('@react-native-async-storage/async-storage')
    const files = [...sources(join(root, 'src')), ...sources(join(root, 'app'))]
    const offenders = files.filter((f) => {
      const code = readFileSync(f, 'utf8')
      return /AsyncStorage|localStorage|MMKV/.test(code) || (!f.endsWith('storage.ts') && /from 'expo-secure-store'/.test(code))
    })
    expect(offenders).toEqual([])
  })
})
