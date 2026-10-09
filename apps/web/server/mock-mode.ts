import { config } from './config'
/** Dev-only routes exist only with MOCK_MODE=1 and AUTH_MODE=dev (which config() refuses in production). */
export const mockMode = () => process.env.MOCK_MODE === '1' && config().AUTH_MODE === 'dev'
/**
 * DEMO ONLY (`pnpm demo`): mock mode without the one-time code, for recording a demo. The session records
 * 'demo-no-otp' instead of 'otp', so it never passes for real MFA; only this mode accepts it for approval.
 */
export const demoNoOtp = () => mockMode() && process.env.DEMO_SKIP_OTP === '1'
