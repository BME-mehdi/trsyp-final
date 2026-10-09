import { DecisionLog } from '../../../../../features/decisions/DecisionLog'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <DecisionLog patientId={(await params).id} />
}
