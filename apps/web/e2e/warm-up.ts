// `next dev` compiles a route on its first request; warm them so the tests measure the app, not the compiler.
export default async function warmUp() {
  const pages = ['/signin', '/dev-login', '/', '/patients/x', '/patients/x/sessions', '/patients/x/safety', '/patients/x/charts', '/patients/x/decisions', '/patients/x/audit', '/bench']
  const apis = ['/api/patients', '/api/patients/x/plan', '/api/patients/x/suggestion', '/api/patients/x/sessions', '/api/patients/x/plan/history', '/api/patients/x/decisions', '/api/patients/x/audit', '/api/auth/session']
  for (const p of [...pages, ...apis]) await fetch(`http://localhost:3000${p}`, { redirect: 'manual' }).catch(() => undefined)
}
