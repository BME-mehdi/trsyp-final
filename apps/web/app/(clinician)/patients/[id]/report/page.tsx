import { WeeklyReport } from '../../../../../features/weekly-report/WeeklyReport'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <WeeklyReport patientId={(await params).id} />
}
