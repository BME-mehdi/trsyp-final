import { SessionList } from '../../../../../features/sessions/SessionList'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <SessionList patientId={(await params).id} />
}
