import { screen } from '@testing-library/react-native'
import { progress } from '../src/logic'
import { ProgressScreen } from '../src/screens/Progress'
import { patientSessions, renderScreen } from './render'

describe('Progress', () => {
  it('shows flexion versus goal, engagement and adherence', async () => {
    await renderScreen(<ProgressScreen />)
    expect(await screen.findByText('Knee bend')).toBeTruthy()
    expect(screen.getByText(/° \(goal 110°\)/)).toBeTruthy()
    expect(screen.getByText(/% of your target/)).toBeTruthy()
    expect(screen.getByText(/of 14 this week/)).toBeTruthy()
  })

  it('computes engagement against the target and adherence over 7 days', async () => {
    const s = patientSessions()
    const now = new Date(Date.parse(s.at(-1)!.startedAt) + 3_600_000)
    const p = progress(s, 30, now)
    expect(p.adherence.planned).toBe(14)
    expect(p.adherence.done).toBeGreaterThan(10)
    expect(p.adherence.done).toBeLessThanOrEqual(14)
    expect(p.engagementPct).toBeGreaterThan(50)
    expect(p.week).toBe(6)
  })
})
