import * as fx from '@symbiomed/fixtures'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  LOCAL_CODE_SYSTEMS,
  UCUM,
  UNITS,
  auditToAuditEvent,
  braceToDevice,
  decisionToProvenance,
  planToCarePlan,
  sessionToFhir,
  suggestionToCarePlan,
} from './index'

const todo = readFileSync(new URL('../../../docs/TERMINOLOGY_TODO.md', import.meta.url), 'utf8')
const LOCAL = 'https://symbiomed.example/fhir/CodeSystem/'

// Every coding and quantity the builders emit, from the full fixture set.
const resources = [
  ...fx.suggestions.map((s) => suggestionToCarePlan(s)),
  ...fx.plans.map(planToCarePlan),
  ...fx.decisions.map(decisionToProvenance),
  ...fx.sessions.flatMap((s) => { const r = sessionToFhir(s); return [r.procedure, ...r.observations, ...(r.adverseEvent ? [r.adverseEvent] : [])] }),
  ...fx.braces.map(braceToDevice),
  auditToAuditEvent({ auditId: 'a1', interaction: 'read', recorded: fx.FIXTURE_NOW, outcome: '0', agent: 'Practitioner/pr-001', entities: ['Patient/pt-1'] }),
]
const found = { codings: [] as { system: string; code: string }[], quantities: [] as { system?: string; code?: string }[] }
JSON.stringify(resources, (_k, v: unknown) => {
  if (v && typeof v === 'object' && 'system' in v && 'code' in v) {
    const c = v as { system: string; code: string; value?: unknown }
    if ('value' in c) found.quantities.push(c)
    else found.codings.push(c)
  }
  return v
})

describe('terminology', () => {
  it('lists every local code in docs/TERMINOLOGY_TODO.md', () => {
    const missing = LOCAL_CODE_SYSTEMS.flatMap((cs) => {
      const name = cs.url!.slice(LOCAL.length)
      return (cs.concept ?? []).map((c) => `${name}#${c.code}`).filter((line) => !todo.includes(line))
    })
    expect(missing).toEqual([])
  })

  it('emits only local codes that exist in the local CodeSystems', () => {
    const known = new Set(LOCAL_CODE_SYSTEMS.flatMap((cs) => (cs.concept ?? []).map((c) => `${cs.url}#${c.code}`)))
    const unknown = found.codings.filter((c) => c.system.startsWith(LOCAL) && !known.has(`${c.system}#${c.code}`))
    expect(found.codings.length).toBeGreaterThan(0)
    expect(unknown).toEqual([])
  })

  it('emits UCUM quantities only, with the unit codes this package defines', () => {
    const units = new Set<string>(Object.values(UNITS))
    expect(found.quantities.length).toBeGreaterThan(0)
    expect(found.quantities.filter((q) => q.system !== UCUM || !units.has(q.code ?? ''))).toEqual([])
  })
})
