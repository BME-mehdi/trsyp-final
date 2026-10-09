import { SafetyEvents } from '../../../../../features/safety/SafetyEvents'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <SafetyEvents patientId={(await params).id} />
}
