import { statusTone, type StatusTone } from '@symbiomed/ui-tokens'

// Static class names so Tailwind sees them. Every chip has a text label: colour never carries status alone.
const TONE: Record<StatusTone, string> = {
  positive: 'bg-positive-bg text-positive-fg',
  info: 'bg-info-bg text-info-fg',
  caution: 'bg-caution-bg text-caution-fg',
  neutral: 'bg-neutral-bg text-neutral-fg',
  critical: 'bg-critical-bg text-critical-fg',
}

export type PlanStatus = keyof typeof statusTone.plan
export type SafetyKind = keyof typeof statusTone.safety
const PLAN_LABEL: Record<PlanStatus, string> = { draft: 'Draft', pending: 'Pending approval', active: 'Active', expired: 'Expired' }
export const SAFETY_LABEL: Record<SafetyKind, string> = { 'stop-pressed': 'STOP pressed', 'high-pain': 'Pain 4/10 or more', 'device-stop': 'Brace stopped', degraded: 'Fixed-dose fallback' }

const Chip = ({ tone, children }: { tone: StatusTone; children: string }) => (
  <span className={`inline-block rounded px-2 py-0.5 text-sm font-semibold whitespace-nowrap ${TONE[tone]}`}>{children}</span>
)
export const PlanChip = ({ status }: { status: PlanStatus }) => <Chip tone={statusTone.plan[status]}>{PLAN_LABEL[status]}</Chip>
export const SafetyChip = ({ kind }: { kind: SafetyKind }) => <Chip tone={statusTone.safety[kind]}>{SAFETY_LABEL[kind]}</Chip>
