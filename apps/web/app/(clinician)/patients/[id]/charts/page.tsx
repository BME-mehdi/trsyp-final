import { Charts } from '../../../../../features/charts/Charts'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <Charts patientId={(await params).id} />
}
