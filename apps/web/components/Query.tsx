'use client'
import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'

/** Loading and error states for one query, announced to screen readers. No error details (no PHI). */
export function Query<T>({ q, children }: { q: UseQueryResult<T>; children: (data: T) => ReactNode }) {
  if (q.isPending) return <p role="status" className="text-muted">Loading…</p>
  if (q.isError) return <p role="alert" className="text-critical-fg">Could not load this information. Try again later.</p>
  return <>{children(q.data)}</>
}
