import { notFound } from 'next/navigation'
import { Bench } from '../../../features/bench/Bench'

export default function Page() {
  if (process.env.NEXT_PUBLIC_FEATURE_BENCH !== '1') notFound()
  return <Bench />
}
