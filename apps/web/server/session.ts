import { randomBytes } from 'node:crypto'
import type { Principal } from './auth'

/**
 * Server-side web sessions. The browser only holds an opaque id in an httpOnly, Secure,
 * SameSite=Strict cookie; tokens never reach the browser (CLAUDE.md).
 * ponytail: in-memory, per process (kept on globalThis so route handlers and pages share it);
 * use a shared store (e.g. Redis) when the BFF runs on more than one instance.
 */
export type Session = { id: string; principal: Principal; csrf: string; idToken: string | null; createdAt: number; lastSeen: number }

export const SESSION_COOKIE = '__Host-symbiomed-session'
export const IDLE_TIMEOUT_S = 15 * 60 // CLAUDE.md: idle timeout 15 minutes on web
const ABSOLUTE_LIFETIME_S = 12 * 3600

const g = globalThis as { __symbiomedSessions?: Map<string, Session> }
const sessions = (g.__symbiomedSessions ??= new Map())

export function createSession(principal: Principal, idToken: string | null = null, now = Date.now()): Session {
  const s: Session = { id: randomBytes(32).toString('base64url'), principal, csrf: randomBytes(32).toString('base64url'), idToken, createdAt: now, lastSeen: now }
  sessions.set(s.id, s)
  return s
}

/** The live session for an id; refreshes the idle timer. Expired sessions are removed. */
export function readSession(id: string | undefined, now = Date.now(), touch = true): Session | null {
  const s = id ? sessions.get(id) : undefined
  if (!s) return null
  if (now - s.lastSeen > IDLE_TIMEOUT_S * 1000 || now - s.createdAt > ABSOLUTE_LIFETIME_S * 1000) {
    sessions.delete(s.id)
    return null
  }
  if (touch) s.lastSeen = now
  return s
}

export const destroySession = (id: string | undefined) => void (id && sessions.delete(id))

export const sessionCookie = (id: string) => `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${ABSOLUTE_LIFETIME_S}`
export const clearSessionCookie = `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`

export function cookieValue(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return undefined
}
