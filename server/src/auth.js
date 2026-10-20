/**
 * Password hashing and session tokens.
 *
 * scrypt from `node:crypto` — no dependency, and slow enough to be useful
 * against a password list.
 */
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto'

const SECRET = process.env.LAB_SECRET ?? 'dev-secret-change-me'
const SESSION_TTL = 1000 * 60 * 60 * 24 * 30 // 30 days

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored.includes(':')) return false
  const [salt, hash] = stored.split(':')
  const candidate = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  if (candidate.length !== expected.length) return false
  return timingSafeEqual(candidate, expected)
}

export function newToken() {
  return randomBytes(32).toString('hex')
}

/** A stable, non-reversible identifier for a user (no secrets involved). */
export function userKey(userId) {
  return createHmac('sha256', SECRET).update(String(userId)).digest('hex').slice(0, 16)
}

export function newJoinCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(6)
  let code = ''
  for (const b of bytes) code += alphabet[b % alphabet.length]
  return code
}

export { SESSION_TTL }
