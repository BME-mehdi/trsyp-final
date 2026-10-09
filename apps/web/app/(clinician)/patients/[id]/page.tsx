import { NextSessionPanel } from '../../../../features/next-session/NextSessionPanel'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <NextSessionPanel patientId={(await params).id} />
}
