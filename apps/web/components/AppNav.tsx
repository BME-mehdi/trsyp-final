'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ICONS = {
  worklist: 'M4 6h16M4 12h16M4 18h10',
  bench: 'M7 4v6M17 4v6M5 10h14v3a7 7 0 0 1-14 0zM12 20v-2',
} as const

/** Sidebar navigation. Patient pages belong to the worklist. Icons repeat the text and are hidden. */
export function AppNav({ bench }: { bench: boolean }) {
  const path = usePathname()
  const items = [
    { href: '/', label: 'Worklist', icon: ICONS.worklist, current: path === '/' || path.startsWith('/patients') },
    ...(bench ? [{ href: '/bench', label: 'Bench (USB)', icon: ICONS.bench, current: path.startsWith('/bench') }] : []),
  ]
  return (
    <nav aria-label="Main" className="flex gap-1 lg:flex-col">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={i.current ? 'page' : undefined}
          className={`flex min-h-11 items-center gap-3 rounded-lg px-3 font-semibold ${i.current ? 'bg-accent text-on-accent' : 'text-ink hover:bg-surface'}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0"><path d={i.icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {i.label}
        </Link>
      ))}
    </nav>
  )
}
