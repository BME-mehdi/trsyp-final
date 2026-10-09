import { auditRead } from '../../server/audit'
import { suggestPlan } from '../../server/extension/suggest-plan'
import { patientRoute } from '../../server/route'

/** The AI suggestion waiting for review. Clinicians only; labelled simulated by the schema. */
export const getSuggestion = patientRoute(['clinician'], async ({ principal, patientId }) => {
  const suggestion = await suggestPlan(patientId)
  await auditRead(principal, 'read', [`Patient/${patientId}`, ...(suggestion ? [`CarePlan/${suggestion.suggestionId}`] : [])])
  return { suggestion }
})
