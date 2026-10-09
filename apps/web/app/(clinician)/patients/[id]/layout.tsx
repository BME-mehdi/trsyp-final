import type { ReactNode } from 'react'
import { PatientNav } from '../../../../components/PatientNav'

export default async function PatientLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <>
      <PatientNav patientId={id} />
      <div className="rounded-xl border border-divider bg-page p-6">{children}</div>
    </>
  )
}
