import { z } from 'zod'

const Env = z
  .object({
    FHIR_BASE_URL: z.url(),
    AUTH_MODE: z.enum(['oidc', 'dev']),
    OIDC_ISSUER: z.url().optional(), // e.g. http://localhost:8180/realms/symbiomed
    OIDC_AUDIENCE: z.string().min(1).optional(),
    OIDC_CLIENT_ID: z.string().min(1).default('symbiomed-web'),
    /** Public origin of this app: OIDC redirect URI and the Origin check on cookie-authenticated writes. */
    APP_URL: z.url().default('http://localhost:3000'),
    DEV_AUTH_SECRET: z.string().min(32).optional(),
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
    /** EXTENSION POINT: base URL of the existing Node.js backend that runs Model B. Unset = fixtures. */
    SYMBIOMED_BACKEND_URL: z.url().optional(),
    NODE_ENV: z.string().optional(),
  })
  .superRefine((e, ctx) => {
    if (e.AUTH_MODE === 'oidc' && (!e.OIDC_ISSUER || !e.OIDC_AUDIENCE)) ctx.addIssue({ code: 'custom', message: 'AUTH_MODE=oidc needs OIDC_ISSUER and OIDC_AUDIENCE' })
    if (e.AUTH_MODE === 'dev' && !e.DEV_AUTH_SECRET) ctx.addIssue({ code: 'custom', message: 'AUTH_MODE=dev needs DEV_AUTH_SECRET (32+ characters)' })
    if (e.AUTH_MODE === 'dev' && e.NODE_ENV === 'production') ctx.addIssue({ code: 'custom', message: 'AUTH_MODE=dev is refused in production' })
  })
export type Config = z.infer<typeof Env>

/** Reads and checks the environment. Called at server start (instrumentation.ts) so a gap fails fast. */
export function config(): Config {
  const r = Env.safeParse(process.env)
  if (!r.success) throw new Error(`BFF configuration invalid: ${r.error.issues.map((i) => `${i.path.join('.') || 'env'}: ${i.message}`).join('; ')}`)
  return r.data
}

/** Re-authentication needed before approving a plan (CLAUDE.md: step-up within 5 minutes). */
export const STEP_UP_MAX_AGE_S = 300
