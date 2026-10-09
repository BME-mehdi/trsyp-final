import { AuditView } from '../../../../../features/audit/AuditView'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <AuditView patientId={(await params).id} />
}
