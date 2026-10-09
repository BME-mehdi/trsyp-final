import { describe, expect, it } from 'vitest'
import { ApiError, createApiClient } from './index'

const fake = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status })

describe('createApiClient', () => {
  it('sends the bearer token and validates the response', async () => {
    let auth: string | null = null
    const c = createApiClient({
      baseUrl: 'http://bff',
      getToken: async () => 'tok',
      fetch: async (_url, init) => ((auth = new Headers(init?.headers).get('authorization')), new Response(JSON.stringify({ plan: null }))),
    })
    expect(await c.getPlan('pt-1')).toEqual({ plan: null })
    expect(auth).toBe('Bearer tok')
  })
  it('throws ApiError with the contract code, or "unexpected"', async () => {
    const e = await createApiClient({ baseUrl: '', fetch: fake(403, { error: 'forbidden', message: 'no' }) }).getPlan('x').catch((x: unknown) => x)
    expect([(e as ApiError).status, (e as ApiError).code]).toEqual([403, 'forbidden'])
    const u = await createApiClient({ baseUrl: '', fetch: fake(500, 'oops') }).getPlan('x').catch((x: unknown) => x)
    expect((u as ApiError).code).toBe('unexpected')
  })
  it('refuses a response that breaks the contract', async () => {
    await expect(createApiClient({ baseUrl: '', fetch: fake(200, { plan: { ceilingMa: 80 } }) }).getPlan('x')).rejects.toThrow()
  })
})
