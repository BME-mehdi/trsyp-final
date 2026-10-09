'use client'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useApi } from '../lib/client'

const TABS = [
  ['', 'Next session'],
  ['/sessions', 'Sessions'],
  ['/safety', 'Safety events'],
  ['/charts', 'Charts'],
  ['/decisions', 'Decision log'],
  ['/audit', 'Audit'],
] as const

export function PatientNav({ patientId }: { patientId: string }) {
  const { api } = useApi()
  const path = usePathname()
  const label = useQuery({ queryKey: ['patients'], queryFn: () => api.listPatients() }).data?.patients.find((p) => p.patientId === patientId)?.label
  const base = `/patients/${patientId}`
  return (
    <div className="mb-6">
      <p className="text-sm text-muted">Patient</p>
      <p className="text-xl font-semibold">{label ?? patientId}</p>
      <nav aria-label="Patient" className="mt-3 flex flex-wrap gap-1 border-b border-divider">
        {TABS.map(([href, name]) => {
          const current = path === base + href
          return (
            <Link key={href} href={base + href} aria-current={current ? 'page' : undefined}
              className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-3 ${current ? 'border-accent font-semibold text-accent' : 'border-transparent'}`}>
              {name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
