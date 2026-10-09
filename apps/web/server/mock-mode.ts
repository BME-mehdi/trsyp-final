import { config } from './config'
/** Dev-only routes exist only with MOCK_MODE=1 and AUTH_MODE=dev (which config() refuses in production). */
export const mockMode = () => process.env.MOCK_MODE === '1' && config().AUTH_MODE === 'dev'
